import * as d3 from "d3";
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

        data.forEach(d => {
            const parts = d.Ecosystem.split(">");
            d.level1 = parts[0];
            d.level2 = parts[1] || null;
        });

        let grouping = d3.groups(
            data,
            d => d.level1,
            d => d.level2
        );


        let hierarchy = {
            name: "EFI",
            children: grouping.map(([level1, level2Groups]) => ({
                name: level1,
                children: level2Groups.map(([level2, entries]) => {

                    if (level2 === null) {
                        // no second level → titles directly under parent
                        return entries.map(d => ({ name: d.Title }));
                    }

                    return {
                        name: level2,
                        children: entries.map(d => ({ name: d.Title }))
                    };
                }).flat()
            }))
        };

        console.log(hierarchy);

        console.log(hierarchy);


        datasetsStore.set({
            data,
            hierarchy
        });


        dataStatus.set({ loading: false, error: null });
    } catch (error) {
        dataStatus.set({ loading: false, error });
        throw error;
    }
}
