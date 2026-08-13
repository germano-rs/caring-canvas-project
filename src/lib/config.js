import { z } from "zod";
export const configSchema = z.object({
    spreadsheetUrl: z.string().url().optional(),
    autoGeocode: z.boolean().default(false),
    columnMapping: z.object({
        cep: z.string(),
        rua: z.string(),
        bairro: z.string(),
        longitude: z.string(),
        latitude: z.string(),
        data: z.string(),
        evento: z.string().optional(),
    }),
});
const STORAGE_KEY = "health-heatmap-config";
export const defaultConfig = {
    autoGeocode: false,
    columnMapping: {
        cep: "cep",
        rua: "rua",
        bairro: "bairro",
        longitude: "longitude",
        latitude: "latitude",
        data: "data",
        evento: "evento",
    },
};
export function getConfig() {
    if (typeof window === "undefined")
        return defaultConfig;
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved)
        return defaultConfig;
    try {
        return configSchema.parse(JSON.parse(saved));
    }
    catch {
        return defaultConfig;
    }
}
export function saveConfig(config) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}
