interface User {
  username: string;
}

declare module 'express-session' {
  interface SessionData {
    user: User;
  }
}

export {};
