-- AlterTable
ALTER TABLE "User" ADD COLUMN     "CPI" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "isCompleted" BOOLEAN NOT NULL DEFAULT false;
