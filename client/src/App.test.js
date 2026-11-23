import { act, fireEvent, render, screen, within } from "@testing-library/react";
import App from "./App";
import { useSocket } from "./SocketContext";

// CRA's Jest resolver does not support the react-router/dom package export.
jest.mock("react-router-dom", () => {
  global.TextEncoder = require("util").TextEncoder;
  return jest.requireActual("react-router");
});

jest.mock("./SocketContext", () => ({
  SocketProvider: ({ children }) => children,
  useSocket: jest.fn(),
}));

test("the client can change languages across screens and keeps the choice on reload", () => {
  sessionStorage.clear();
  localStorage.removeItem("aceRaceLanguage");
  window.history.replaceState(null, "", "/");
  useSocket.mockReturnValue({ emit: jest.fn() });

  try {
    const { unmount } = render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "How to play" }));
    const rules = within(screen.getByRole("dialog"));
    fireEvent.change(rules.getByRole("combobox", { name: "Language" }), {
      target: { value: "fr" },
    });
    expect(document.documentElement).toHaveAttribute("lang", "fr");
    fireEvent.click(rules.getByRole("button", { name: "Fermer les règles" }));
    fireEvent.click(screen.getByRole("button", { name: "Rejoindre une course" }));

    fireEvent.change(screen.getByLabelText("Ton nom"), { target: { value: "Ada" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Langue" }), {
      target: { value: "es" },
    });
    expect(screen.getByLabelText("Tu nombre")).toHaveValue("Ada");
    expect(document.documentElement).toHaveAttribute("lang", "es");

    unmount();
    render(<App />);
    expect(screen.getByRole("combobox", { name: "Idioma" })).toHaveValue("es");
    expect(screen.getByRole("button", { name: "Entrar en el paddock" })).toBeEnabled();
  } finally {
    localStorage.removeItem("aceRaceLanguage");
  }
});

test("the host can retry room creation and get an invite after a connection error", () => {
  sessionStorage.clear();
  window.history.replaceState(null, "", "/host");
  const canvas = jest
    .spyOn(HTMLCanvasElement.prototype, "getContext")
    .mockReturnValue(null);
  try {
    const listeners = new Map();
    const socket = {
      connected: false,
      on: (event, listener) => listeners.set(event, listener),
      off: (event) => listeners.delete(event),
      connect: jest.fn(),
      timeout: () => socket,
      emit: jest.fn((event, code, callback) => {
        if (event === "createRoom") callback(null, { success: true });
        if (event === "getPlayers") callback([]);
      }),
    };
    useSocket.mockReturnValue(socket);

    render(<App />);
    expect(screen.getByRole("status")).toHaveTextContent("Connecting");
    expect(socket.emit).not.toHaveBeenCalled();

    act(() => listeners.get("connect_error")());
    expect(screen.getByRole("alert")).toHaveTextContent("Could not connect");
    fireEvent.click(screen.getByRole("button", { name: "Retry connection" }));
    expect(socket.connect).toHaveBeenCalledTimes(2);

    socket.connected = true;
    act(() => listeners.get("connect")());
    const code = socket.emit.mock.calls[0][1];
    expect(screen.getByRole("link", { name: "Open invite link" })).toHaveAttribute(
      "href",
      `${window.location.origin}/waitingroom/${code}`,
    );
  } finally {
    canvas.mockRestore();
  }
});

test("a new player can open a room invite and join with only their name", async () => {
  sessionStorage.clear();
  window.history.replaceState(null, "", "/waitingroom/3975");
  const emit = jest.fn((event, ...args) => {
    const reply = args.at(-1);
    if (event === "joinRoom") reply({ success: true });
    if (event === "resumeRoom") {
      reply({
        success: true,
        state: {
          phase: "lobby",
          players: [{ socketId: "player-1", username: "Ada" }],
        },
      });
    }
  });
  useSocket.mockReturnValue({ connected: true, emit, on: jest.fn(), off: jest.fn() });

  render(<App />);
  const nameInput = await screen.findByLabelText("Your name");
  expect(screen.queryByLabelText("Four-digit race code")).not.toBeInTheDocument();
  fireEvent.change(nameInput, { target: { value: "Ada" } });
  fireEvent.click(screen.getByRole("button", { name: /enter the paddock/i }));

  expect(emit).toHaveBeenCalledWith("joinRoom", "Ada", "3975", expect.any(Function));
  expect(await screen.findByText("Ada")).toBeInTheDocument();
  expect(window.location.pathname).toBe("/waitingroom/3975");
});

test("the player sees their chips, backed lane, and ceremony cue", () => {
  jest.useFakeTimers();
  try {
    window.history.replaceState(null, "", "/game/3975");
    const listeners = new Map();
    useSocket.mockReturnValue({
      auth: { sessionId: "ada" },
      connected: false,
      emit: jest.fn(),
      on: (event, listener) => listeners.set(event, listener),
      off: jest.fn(),
    });
    render(<App />);
    const ada = { socketId: "ada", username: "Ada", bet: {}, total: 3, sources: [] };
    const bea = { ...ada, socketId: "bea", username: "Bea" };
    act(() => listeners.get("updatePlayers")([ada, bea]));
    fireEvent.click(screen.getByRole("button", { name: "Increase clubs bet" }));
    expect(
      document.querySelector(".betting-card--clubs .betting-chip"),
    ).toBeInTheDocument();
    expect(
      document.querySelector(".betting-card--clubs .betting-chip-stack"),
    ).toBeInTheDocument();
    expect(screen.getByText("sip wagered", { exact: false })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm bets" })).toBeEnabled();

    const players = [bea, ada];
    act(() => listeners.get("drinkingCeremony")({ players, currentIndex: 0 }));
    expect(document.querySelector(".turn-spotlight")).not.toBeInTheDocument();
    act(() => listeners.get("drinkingCeremony")({ players, currentIndex: 1 }));
    expect(document.querySelector(".turn-spotlight")).toBeInTheDocument();
    act(() => listeners.get("startGame")({ grid: [] }));
    expect(screen.getByText("Your pick").closest(".race-lane")).toHaveClass(
      "race-lane--clubs",
    );

    act(() => listeners.get("postDrinkingCeremony")({ players, currentIndex: 1 }));
    const tally = document.querySelector(
      ".player-ceremony__ticket strong [aria-hidden]",
    );
    expect(tally).toHaveTextContent("0");
    act(() => jest.advanceTimersByTime(700));
    expect(tally).toHaveTextContent("3");
  } finally {
    jest.useRealTimers();
  }
});

test("the host gets live race calls, a close finish, and a fresh deck on replay", () => {
  jest.useFakeTimers();
  try {
    window.history.replaceState(null, "", "/gamehost/3975");
    const listeners = new Map();
    useSocket.mockReturnValue({
      connected: false,
      on: (event, listener) => listeners.set(event, listener),
      off: jest.fn(),
    });
    const grid = Array.from({ length: 8 }, () => []);
    grid[7] = ["clubs_ace", "diamonds_ace", "hearts_ace", "spades_ace"];
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Broadcast view" }));
    expect(document.querySelector(".host-page--broadcast")).toBeInTheDocument();
    const paddock = document.getElementById("host-paddock");
    expect(paddock).toHaveAttribute("hidden");
    fireEvent.click(screen.getByRole("button", { name: "Show paddock" }));
    expect(paddock).not.toHaveAttribute("hidden");
    act(() => listeners.get("startGame")({ grid }));
    expect(document.querySelectorAll(".starting-gate")).toHaveLength(4);

    const nearFinish = [...grid];
    nearFinish[1] = ["clubs_ace", "diamonds_ace"];
    nearFinish[7] = ["", "", "hearts_ace", "spades_ace"];
    act(() => {
      listeners.get("cardFlipped")("clubs_2", ["clubs_2", "diamonds_2", "clubs_3"]);
      listeners.get("updateGrid")(nearFinish);
    });
    expect(screen.getByText(/one length from the finish/)).toBeInTheDocument();
    expect(document.querySelectorAll(".draw-fan img")).toHaveLength(3);

    const finished = [...nearFinish];
    finished[0] = ["clubs_ace"];
    finished[1] = ["", "diamonds_ace"];
    act(() => {
      listeners.get("updateGrid")(finished);
      listeners.get("gameWon")({ winner: "clubs_ace", players: [] });
    });
    expect(screen.getByText("Photo finish")).toBeInTheDocument();
    act(() => jest.advanceTimersByTime(4100));
    expect(screen.getByText("Official race result")).toBeInTheDocument();
    act(() =>
      listeners.get("newGame")({
        players: [],
        grid,
        roundHistory: [{ number: 1, winner: "clubs_ace", payouts: [] }],
      }),
    );
    expect(document.querySelectorAll(".replay-deal img")).toHaveLength(4);
    expect(screen.queryByText("Recent draws")).not.toBeInTheDocument();
    expect(screen.getByText("Round history (1)")).toBeInTheDocument();
    expect(screen.getByText("Round 1 · clubs wins")).toBeInTheDocument();
  } finally {
    jest.useRealTimers();
  }
});

test("auto flip waits for acknowledgments and the cramp animation, then stops on a win", () => {
  jest.useFakeTimers();
  try {
    window.history.replaceState(null, "", "/gamehost/3975");
    const listeners = new Map();
    const emit = jest.fn();
    const socket = {
      connected: false,
      on: (event, listener) => listeners.set(event, listener),
      off: jest.fn(),
      timeout: () => ({ emit }),
    };
    useSocket.mockReturnValue(socket);
    render(<App />);
    socket.connected = true;
    const grid = Array.from({ length: 8 }, () => []);
    grid[7] = ["clubs_ace", "", "", "", "back_of_card"];
    act(() => listeners.get("startGame")({ grid }));
    const auto = screen.getByRole("button", { name: "Auto flip" });
    const interval = screen.getByRole("combobox", { name: "Draw interval" });
    expect(interval).toHaveValue("1000");
    fireEvent.change(interval, { target: { value: "1500" } });

    fireEvent.click(auto);
    act(() => jest.advanceTimersByTime(500));
    fireEvent.click(auto);
    act(() => jest.advanceTimersByTime(1500));
    expect(emit).not.toHaveBeenCalled();

    fireEvent.click(auto);
    expect(auto).toHaveAttribute("aria-pressed", "true");
    act(() => jest.advanceTimersByTime(1499));
    expect(emit).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(1));
    act(() => jest.advanceTimersByTime(2200));
    expect(emit).toHaveBeenCalledTimes(1);
    act(() => {
      listeners.get("cardFlipped")("hearts_2");
      listeners.get("updateGrid")(grid, null);
      emit.mock.calls[0][2](null, { success: true });
    });
    act(() => jest.advanceTimersByTime(1500));
    expect(emit).toHaveBeenCalledTimes(2);

    const crampGrid = [...grid];
    crampGrid[7] = ["clubs_ace", "", "", "", "clubs_3"];
    act(() => {
      listeners.get("cardFlipped")("clubs_2");
      listeners.get("updateGrid")(crampGrid, "clubs_3");
      emit.mock.calls[1][2](null, { success: true });
    });
    expect(screen.getByText("Cramp card revealed")).toBeInTheDocument();
    fireEvent.change(interval, { target: { value: "2000" } });
    act(() => jest.advanceTimersByTime(3000));
    expect(emit).toHaveBeenCalledTimes(2);
    act(() => jest.advanceTimersByTime(1999));
    expect(emit).toHaveBeenCalledTimes(2);
    act(() => jest.advanceTimersByTime(1));
    expect(emit).toHaveBeenCalledTimes(3);

    act(() => {
      listeners.get("gameWon")({ winner: "clubs_ace", players: [] });
      emit.mock.calls[2][2](null, { success: true });
    });
    expect(auto).toHaveAttribute("aria-pressed", "false");
    act(() => jest.advanceTimersByTime(6000));
    expect(emit).toHaveBeenCalledTimes(3);
  } finally {
    jest.useRealTimers();
  }
});

test.each(["game", "gamehost"])(
  "the %s view shows the cramp card before the affected ace falls back",
  (route) => {
    jest.useFakeTimers();
    const measure = jest.spyOn(HTMLElement.prototype, "getBoundingClientRect");
    measure.mockImplementation(function () {
      if (this.classList.contains("cramp-reveal__destination")) {
        return { left: 200, top: 100, width: 240, height: 360 };
      }
      return { left: 60, top: 400, width: 40, height: 60 };
    });
    try {
      window.history.replaceState(null, "", `/${route}/3975`);
      const listeners = new Map();
      const emit = jest.fn();
      useSocket.mockReturnValue({
        connected: false,
        emit,
        on: (event, listener) => listeners.set(event, listener),
        off: jest.fn(),
      });

      render(<App />);
      const grid = Array.from({ length: 8 }, () => []);
      grid[7] = ["clubs_ace", "", "", "", "back_of_card"];
      act(() => listeners.get("startGame")({ grid }));
      const runner = document.querySelector(".race-lane--clubs .race-lane__runner");
      expect(runner).toHaveStyle({ left: "0%" });
      if (route === "gamehost") {
        const draw = screen.getByRole("button", { name: /flip next card/i });
        fireEvent.click(draw);
        expect(draw).toBeEnabled();
        act(() => listeners.get("updateGrid")(grid, null));
        fireEvent.click(draw);
        expect(emit.mock.calls).toEqual([
          ["flipCard", "3975"],
          ["flipCard", "3975"],
        ]);
      }

      const nextGrid = [...grid];
      nextGrid[7] = ["clubs_ace", "", "", "", "clubs_3"];
      act(() => {
        listeners.get("cardFlipped")("clubs_2");
        listeners.get("updateGrid")(nextGrid, "clubs_3");
      });
      const reveal = screen.getByRole("status");
      expect(reveal).toHaveTextContent("3 of clubs");
      expect(reveal.querySelector(".cramp-reveal__flip img")).toHaveAttribute(
        "src",
        "/Images/back_of_card.png",
      );
      const crampSlot = screen.getByLabelText("Link 1: 3 of clubs");
      expect(crampSlot).toHaveClass("is-flying");
      const destination = reveal.querySelector(".cramp-reveal__destination");
      expect(destination.style.getPropertyValue("--flight-x")).toBe("-240px");
      expect(destination.style.getPropertyValue("--flight-y")).toBe("150px");
      expect(Number(destination.style.getPropertyValue("--flight-scale"))).toBeCloseTo(
        1 / 6,
      );
      expect(runner).toHaveStyle({ left: `${(1 / 7) * 100}%` });
      if (route === "gamehost") {
        expect(screen.getByRole("button", { name: /flip next card/i })).toBeDisabled();
      }

      act(() => jest.advanceTimersByTime(2050));
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
      expect(crampSlot).not.toHaveClass("is-flying");
      expect(screen.getByLabelText("clubs back one length")).toHaveTextContent("−1");
      expect(runner).toHaveStyle({ left: "0%" });

      act(() => jest.advanceTimersByTime(950));
      expect(screen.queryByLabelText("clubs back one length")).not.toBeInTheDocument();
      if (route === "gamehost") {
        expect(screen.getByRole("button", { name: /flip next card/i })).toBeEnabled();
      }
    } finally {
      measure.mockRestore();
      jest.useRealTimers();
    }
  },
);

test.each(["game", "gamehost"])(
  "the %s view reveals the winning ace before switching away from the track",
  (route) => {
    jest.useFakeTimers();
    try {
      window.history.replaceState(null, "", `/${route}/3975`);
      const listeners = new Map();
      useSocket.mockReturnValue({
        connected: false,
        on: (event, listener) => listeners.set(event, listener),
        off: jest.fn(),
      });

      render(<App />);
      act(() => listeners.get("startGame")({ grid: [] }));
      const track = screen.getByRole("region", { name: "Live race positions" });
      act(() => {
        listeners.get("cardFlipped")("hearts_king");
        listeners.get("gameWon")({ winner: "hearts_ace", players: [] });
        if (route === "gamehost") {
          listeners.get("postDrinkingCeremony")({
            players: [{ socketId: "player-1", username: "Ada", total: 0, sources: [] }],
            currentIndex: 0,
          });
        }
      });

      expect(track).toBeInTheDocument();
      expect(screen.getByText("Ace of hearts")).toBeInTheDocument();
      expect(screen.getByAltText("king of hearts")).toBeInTheDocument();
      expect(screen.queryByText("Official race result")).not.toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Ada" })).not.toBeInTheDocument();

      act(() => jest.advanceTimersByTime(3400));
      expect(track).not.toBeInTheDocument();
      expect(
        route === "gamehost"
          ? screen.getByRole("heading", { name: "Ada" })
          : screen.getByText("Official race result"),
      ).toBeInTheDocument();
    } finally {
      jest.useRealTimers();
    }
  },
);
