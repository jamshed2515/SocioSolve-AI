/**
 * Socket.IO Real-Time Client Service (Phase 8).
 *
 * Manages WebSocket connection to the Python FastAPI Socket.IO server:
 * - Automatically attaches Firebase ID Token on connection.
 * - Manages user room and team room subscriptions.
 * - Dispatches typed collaboration and notification events.
 */
import { io, Socket } from "socket.io-client";
import { auth } from "../config/firebase";
import { BACKEND_ORIGIN } from "./api";

class SocketService {
  private socket: Socket | null = null;
  private currentTeamId: string | null = null;
  private connecting: boolean = false;

  /**
   * Initialize or retrieve active Socket.IO connection.
   */
  public async connect(overrideToken?: string): Promise<Socket | null> {
    if (this.socket?.connected) {
      return this.socket;
    }

    if (this.connecting) {
      return null;
    }

    this.connecting = true;
    try {
      let token = overrideToken;
      if (!token) {
        const currentUser = auth.currentUser;
        if (currentUser) {
          token = await currentUser.getIdToken();
        }
      }

      if (!token) {
        // Not authenticated yet
        this.connecting = false;
        return null;
      }

      // Initialize socket instance if not existing
      if (!this.socket) {
        this.socket = io(BACKEND_ORIGIN, {
          path: "/socket.io",
          auth: { token },
          query: { token },
          transports: ["websocket", "polling"],
          reconnection: true,
          reconnectionAttempts: 10,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          timeout: 20000,
          autoConnect: false,
        });

        this.setupDefaultListeners();
      } else {
        // Update auth payload if token refreshed
        this.socket.auth = { token };
      }

      this.socket.connect();
      return this.socket;
    } catch (err) {
      console.warn("[SocketService] Connection error:", err);
      return null;
    } finally {
      this.connecting = false;
    }
  }

  /**
   * Set up connection telemetry and auto-rejoin logic.
   */
  private setupDefaultListeners(): void {
    if (!this.socket) return;

    this.socket.on("connect", () => {
      console.info("[SocketService] Connected to real-time server (id: %s)", this.socket?.id);
      // Rejoin active team room upon reconnection
      if (this.currentTeamId) {
        this.socket?.emit("join_team", { team_id: this.currentTeamId });
      }
    });

    this.socket.on("disconnect", (reason) => {
      console.info("[SocketService] Disconnected from real-time server:", reason);
    });

    this.socket.on("connect_error", (error) => {
      console.warn("[SocketService] Connection failed:", error.message);
    });

    this.socket.on("error", (err) => {
      console.warn("[SocketService] Server error:", err);
    });
  }

  /**
   * Disconnect socket and clear state (e.g. on user logout).
   */
  public disconnect(): void {
    if (this.socket) {
      if (this.currentTeamId) {
        this.leaveTeam(this.currentTeamId);
      }
      this.socket.disconnect();
      this.socket = null;
    }
    this.currentTeamId = null;
    this.connecting = false;
  }

  /**
   * Join an authorized team collaboration room.
   */
  public joinTeam(teamId: string): void {
    if (!teamId) return;
    this.currentTeamId = teamId;
    if (this.socket?.connected) {
      this.socket.emit("join_team", { team_id: teamId });
    } else {
      // Connect first if needed
      void this.connect().then((s) => {
        if (s?.connected) {
          s.emit("join_team", { team_id: teamId });
        }
      });
    }
  }

  /**
   * Leave a team collaboration room.
   */
  public leaveTeam(teamId: string): void {
    if (!teamId) return;
    if (this.socket?.connected) {
      this.socket.emit("leave_team", { team_id: teamId });
    }
    if (this.currentTeamId === teamId) {
      this.currentTeamId = null;
    }
  }

  /**
   * Register an event listener. Returns an unsubscribe function.
   */
  public on<T = any>(event: string, callback: (data: T) => void): () => void {
    if (!this.socket) {
      // Auto-initiate connection
      void this.connect();
    }

    const handler = (data: T) => callback(data);

    if (this.socket) {
      this.socket.on(event, handler);
    }

    return () => {
      if (this.socket) {
        this.socket.off(event, handler);
      }
    };
  }

  /**
   * Remove an event listener.
   */
  public off(event: string, callback?: (...args: any[]) => void): void {
    if (this.socket) {
      if (callback) {
        this.socket.off(event, callback);
      } else {
        this.socket.off(event);
      }
    }
  }

  /**
   * Emit an event to the server.
   */
  public emit(event: string, data?: any): void {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    }
  }

  /**
   * Check connection status.
   */
  public isConnected(): boolean {
    return !!this.socket?.connected;
  }

  /**
   * Retrieve underlying socket instance.
   */
  public getSocket(): Socket | null {
    return this.socket;
  }
}

export const socketService = new SocketService();
export default socketService;
