const databaseUrl = process.env.DATABASE_URL || "file:./bookings_time_itinerary.db";
const provider = databaseUrl.startsWith("postgres://") || databaseUrl.startsWith("postgresql://")
  ? await import("./db-postgres.js")
  : await import("./db-sqlite.js");

export const cleanupOldRecords = provider.cleanupOldRecords;
export const deleteGeneratedFile = provider.deleteGeneratedFile;
export const getFlightItinerary = provider.getFlightItinerary;
export const getGeneratedFileByFilename = provider.getGeneratedFileByFilename;
export const getHotelItinerary = provider.getHotelItinerary;
export const getSetting = provider.getSetting;
export const initDatabase = provider.initDatabase;
export const insertGeneratedFile = provider.insertGeneratedFile;
export const normalizeFlightData = provider.normalizeFlightData;
export const normalizeHotelData = provider.normalizeHotelData;
export const saveFlightItinerary = provider.saveFlightItinerary;
export const saveHotelItinerary = provider.saveHotelItinerary;
export const searchGeneratedFiles = provider.searchGeneratedFiles;
export const setSetting = provider.setSetting;
export const updateGeneratedPdf = provider.updateGeneratedPdf;
