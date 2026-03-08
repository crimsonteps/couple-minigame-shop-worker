import { FIXED_USER_IDS, USER_DIRECTORY } from "../../shared/constants";
import type { OnlineStatus, UserProfile, UserId } from "../../shared/types";
import type { RoomStorage } from "../storage/types";

interface UserRow {
  display_name: string;
  id: UserId;
  score: number;
}

export class UserService {
  constructor(private readonly storage: RoomStorage) {}

  listUsers(onlineStatus: OnlineStatus): UserProfile[] {
    const rows = this.storage.sql.exec<UserRow>(
      "SELECT id, display_name, score FROM users ORDER BY id ASC",
    ).toArray();
    const rowMap = new Map(rows.map((row) => [row.id, row]));

    return FIXED_USER_IDS.map((userId) => {
      const row = rowMap.get(userId);

      return {
        id: userId,
        displayName: row?.display_name ?? USER_DIRECTORY[userId].displayName,
        score: Number(row?.score ?? 0),
        online: onlineStatus[userId],
        role: USER_DIRECTORY[userId].role,
      };
    });
  }
}
