import { NextResponse } from "next/server";
import { getStorageStats, testDatabaseConnection } from "@/utils/api/storage-factory";

export const runtime = "nodejs";

// GET /api/test/storage - Test storage system and get stats
export async function GET(): Promise<NextResponse> {
  try {
    const storageType = process.env.STORAGE_TYPE || "memory";

    const stats = await getStorageStats();
    const dbConnectionWorking = await testDatabaseConnection();

    return NextResponse.json({
      success: true,
      data: {
        storageType,
        databaseConnectionWorking: dbConnectionWorking,
        stats,
        environment: {
          NODE_ENV: process.env.NODE_ENV,
          STORAGE_TYPE: process.env.STORAGE_TYPE,
          DATABASE_PATH: process.env.DATABASE_PATH || "./data/research.db",
        },
      },
    });
  } catch (error) {
    console.error("Storage test error:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Storage test failed",
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
