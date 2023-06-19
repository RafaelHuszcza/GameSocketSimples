-- CreateTable
CREATE TABLE "PositionPlayer" (
    "playerId" TEXT NOT NULL PRIMARY KEY,
    "positionX" INTEGER NOT NULL,
    "positionY" INTEGER NOT NULL,
    "roomId" TEXT,
    CONSTRAINT "PositionPlayer_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Room" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hostId" TEXT NOT NULL,
    "currentTurnPlayerId" TEXT NOT NULL DEFAULT '',
    "gameStarted" BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO "new_Room" ("currentTurnPlayerId", "gameStarted", "hostId", "id") SELECT "currentTurnPlayerId", "gameStarted", "hostId", "id" FROM "Room";
DROP TABLE "Room";
ALTER TABLE "new_Room" RENAME TO "Room";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;

-- CreateIndex
CREATE UNIQUE INDEX "PositionPlayer_playerId_key" ON "PositionPlayer"("playerId");
