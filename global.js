window.GAS_URL = "https://script.google.com/macros/s/AKfycbwSSHrz19nFEeSgozzlHgOWzuemn5RMhYDzSKZD5ADkhYNQHW3Sws2fVL6An90oDcbj7w/exec";

window.globalData = null;
window.BASE_DATE = new Date(2026, 9, 2); // 基準日(2026年10月2日)

window.BASE_VEHICLES = {};     // 運用ベース
window.timetables = [];        // 全運用
window.TakasakaTables = [];    // 高坂便
window.KitasakadoTables = [];  // 北坂戸便
window.KumagayaTables = [];    // 熊谷便
window.KonosuTables = [];      // 鴻巣便

window.formatToDateStr = function(rawVal) {
    if (!rawVal) return "";
    if (typeof rawVal === 'string' && rawVal.includes('T')) {
        const d = new Date(rawVal);
        if (!isNaN(d.getTime())) {
            const jstDate = new Date(d.getTime() + (9 * 60 * 60 * 1000));
            const yyyy = jstDate.getUTCFullYear();
            const mm = String(jstDate.getUTCMonth() + 1).padStart(2, '0');
            const dd = String(jstDate.getUTCDate()).padStart(2, '0');
            return `${yyyy}-${mm}-${dd}`;
        }
    }
    return String(rawVal).substring(0, 10);
};

window.parseDateString = function(dateStr) {
    const parts = dateStr.split('-');
    return new Date(parts[0], parts[1] - 1, parts[2]);
};

window.extractTime = function(isoString) {
    if (!isoString) return "";
    try {
        const tIndex = isoString.indexOf('T');
        if (tIndex !== -1 && isoString.length >= tIndex + 6) {
            let hour = parseInt(isoString.substring(tIndex + 1, tIndex + 3), 10);
            let minute = isoString.substring(tIndex + 4, tIndex + 6);
            hour = (hour + 9) % 24;
            return `${String(hour).padStart(2, '0')}:${minute}`;
        }
        return isoString;
    } catch (e) {
        return String(isoString);
    }
};

window.checkIsHoliday = function(selectedDateStr, holidaysArray) {
    if (!holidaysArray || holidaysArray.length === 0) return null;
    for (let holiday of holidaysArray) {
        let startRaw = holiday["開始日"] || holiday["運休日"] || holiday["日付"] || "";
        let endRaw = holiday["終了日"] || startRaw;
        if (!startRaw) continue;

        let startDateStr = window.formatToDateStr(startRaw);
        let endDateStr = window.formatToDateStr(endRaw);

        if (selectedDateStr >= startDateStr && selectedDateStr <= endDateStr) {
            return holiday;
        }
    }
    return null;
};

window.countBusinessDays = function(startDate, targetDate, holidaysArray) {
    let count = 0;
    let cur = new Date(startDate);
    cur.setHours(0, 0, 0, 0);
    let target = new Date(targetDate);
    target.setHours(0, 0, 0, 0);

    while (cur < target) {
        cur.setDate(cur.getDate() + 1);
        let day = cur.getDay();
        if (day === 0 || day === 6) continue; // 土日スキップ

        let curYear = cur.getFullYear();
        let curMonth = String(cur.getMonth() + 1).padStart(2, '0');
        let curDay = String(cur.getDate()).padStart(2, '0');
        let curDateStr = `${curYear}-${curMonth}-${curDay}`;

        let isHolidayRegistered = false;
        if (holidaysArray && holidaysArray.length > 0) {
            for (let holiday of holidaysArray) {
                let startRaw = holiday["開始日"] || holiday["運休日"] || holiday["日付"] || "";
                let endRaw = holiday["終了日"] || startRaw;
                if (!startRaw) continue;

                let startDateStr = window.formatToDateStr(startRaw);
                let endDateStr = window.formatToDateStr(endRaw);

                if (curDateStr >= startDateStr && curDateStr <= endDateStr) {
                    isHolidayRegistered = true;
                    break;
                }
            }
        }
        if (isHolidayRegistered) continue;
        count++;
    }
    return count;
};

window.loadGlobalData = async function(gasUrl = window.GAS_URL) {
    if (window.globalData) {
        return window.globalData;
    }

    try {
        const response = await fetch(gasUrl);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        window.globalData = await response.json();

        // 運用ベース
        window.BASE_VEHICLES = {};
        if (window.globalData.basevehicle) {
            for (let i = 0; i < window.globalData.basevehicle.length; i++) {
                window.BASE_VEHICLES["R" + (i + 1)] = window.globalData.basevehicle[i]["車両"];
            }
        }

        window.timetables = [];
        window.TakasakaTables = [];
        window.KitasakadoTables = [];
        window.KumagayaTables = [];
        window.KonosuTables = [];

        const rawTimetables = Array.isArray(window.globalData) ? window.globalData : (window.globalData.timetables || []);
        rawTimetables.forEach(row => {
            const op = row["運用"];
            if (!op) return;
            if (!window.timetables[op]) window.timetables[op] = [];
            
            window.timetables[op].push({
                time: window.extractTime(row["発車時刻"]),
                from: row["出発地"],
                to: row["到着地"],
                note: row["備考"]
            });

            const formattedTime = window.extractTime(row["発車時刻"]);
            const tableItem = { number: op, time: formattedTime, from: row["出発地"], to: row["到着地"], note: row["備考"] };

            if (row["出発地"] == "高坂" || row["到着地"] == "高坂") {
                window.TakasakaTables.push(tableItem);
            } else if (row["出発地"] == "北坂戸" || row["到着地"] == "北坂戸") {
                window.KitasakadoTables.push(tableItem);
            } else if (row["出発地"] == "熊谷" || row["到着地"] == "熊谷") {
                window.KumagayaTables.push(tableItem);
            } else {
                window.KonosuTables.push(tableItem);
            }
        });

        return window.globalData;

    } catch (error) {
        console.error("データの取得に失敗しました:", error);
        throw error;
    }
};

window.RoyalNumberChange = function(diffDays) {
    let BASE_VEHICLES_COPY = structuredClone(window.BASE_VEHICLES); //初期状態

    const n = 9;
    diffDays = diffDays % 9;

    const values = [];
    for (let i = 1; i <= n; i++) {
        values.push(BASE_VEHICLES_COPY["R" + i]);
    }

    for (let i = 0; i < diffDays; i++) {
        values.push(values.shift());
    }

    for (let k = 1; k <= n; k++) {
        BASE_VEHICLES_COPY["R" + k] = values[k - 1];
    }

    return BASE_VEHICLES_COPY;
};