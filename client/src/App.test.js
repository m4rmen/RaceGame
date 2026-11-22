import { act, fireEvent, render, screen } from "@testing-library/react";
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
      expect(screen.getByAltText("hearts of king")).toBeInTheDocument();
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
