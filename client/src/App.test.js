import { fireEvent, render, screen } from "@testing-library/react";
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
