import { writable } from "svelte/store";
import { getCSV } from "./utils.js";

export const datasetsStore = writable(null);
export const dataStatus = writable({ loading: false, error: null });

export async function loadData() {
    dataStatus.set({ loading: true, error: null });

    try {
        let data;
        [
            data
        ] = await getCSV([
            "./Ecosystem-Export-2026-March-04-1530.csv",
        ]);

        datasetsStore.set({
            data,
        });

        dataStatus.set({ loading: false, error: null });
    } catch (error) {
        dataStatus.set({ loading: false, error });
        throw error;
    }
}
