export type Category = "fun" | "mind" | "friendship" | "random";
export type GameStatus = "CREATING" | "WAITING" | "PLAYING" | "COMPLETED" | "EXPIRED";

export interface Question {
  id: string;
  category: Exclude<Category, "random">;
  text: string;
  options: string[];
}

export interface Game {
  id: string;
  creatorId: number;
  category: Category;
  inviteToken: string;
  status: GameStatus;
  currentQuestion: number;
  createdAt: number;
  expiresAt: number;
}
