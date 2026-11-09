const GAS_URL = "https://script.google.com/macros/s/AKfycbwSSHrz19nFEeSgozzlHgOWzuemn5RMhYDzSKZD5ADkhYNQHW3Sws2fVL6An90oDcbj7w/exec";

const BASE_DATE = new Date(2026, 9, 2); //基準日(10/2)

let BASE_VEHICLES = [];
let timetables = [];

let TakasakaTables = [];
let KitasakadoTables = [];
let KumagayaTables = [];
let KonosuTables = [];

let globalData = null;

//日付変換
function formatToDateStr(rawVal) {
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
}

//運行日判定
function countBusinessDays(startDate, targetDate, holidaysArray) {
    let count = 0;
    let cur = new Date(startDate);
    cur.setHours(0, 0, 0, 0);
    let target = new Date(targetDate);
    target.setHours(0, 0, 0, 0);

    while (cur < target) {
        cur.setDate(cur.getDate() + 1);

        let day = cur.getDay();
        //土曜=6,日曜=0スキップ
        if (day === 0 || day === 6) {
            continue;
        }

        let curYear = cur.getFullYear();
        let curMonth = String(cur.getMonth() + 1).padStart(2, '0');
        let curDay = String(cur.getDate()).padStart(2, '0');
        let curDateStr = `${curYear}-${curMonth}-${curDay}`;

        //開始日ー終了日チェック
        let isHolidayRegistered = false;
        if (holidaysArray && holidaysArray.length > 0) {
            for (let holiday of holidaysArray) {
                let startRaw = holiday["開始日"] || holiday["運休日"] || holiday["日付"] || "";
                let endRaw = holiday["終了日"] || startRaw;

                if (!startRaw) continue;

                let startDateStr = formatToDateStr(startRaw);
                let endDateStr = formatToDateStr(endRaw);

                //期間内なら休業日
                if (curDateStr >= startDateStr && curDateStr <= endDateStr) {
                    isHolidayRegistered = true;
                    break;
                }
            }
        }

        //休業日期間中はローテーションストップ
        if (isHolidayRegistered) {
            continue;
        }

        //通常運行日ならばカウント
        count++;
    }
    return count;
}

function extractTime(isoString) {
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
}

function parseDateString(dateStr) {
    const parts = dateStr.split('-');
    return new Date(parts[0], parts[1] - 1, parts[2]);
}

//休業期間チェック
function checkIsHoliday(selectedDateStr, holidaysArray) {
    if (!holidaysArray || holidaysArray.length === 0) return null;

    for (let holiday of holidaysArray) {
        let startRaw = holiday["開始日"] || holiday["運休日"] || holiday["日付"] || "";
        let endRaw = holiday["終了日"] || startRaw;

        if (!startRaw) continue;

        let startDateStr = formatToDateStr(startRaw);
        let endDateStr = formatToDateStr(endRaw);

        if (selectedDateStr >= startDateStr && selectedDateStr <= endDateStr) {
            return holiday;
        }
    }
    return null;
}

//描画
async function updateView() {
    const dateInput = document.getElementById("target-date");
    const messageArea = document.getElementById("message-area");
    const loadingBox = document.getElementById("loading");
    const grid = document.getElementById("assignment-grid");

    BASE_VEHICLES = {};
    timetables = [];
    TakasakaTables = [];
    KitasakadoTables = [];
    KumagayaTables = [];
    KonosuTables = [];

    grid.innerHTML = "";

    const selectedDateStr = dateInput.value;
    if (!selectedDateStr) return;

    const targetDate = parseDateString(selectedDateStr);

    if (targetDate < BASE_DATE) {
        messageArea.innerHTML = `<div class="error-box">エラー: 基準日 (2026年10月2日) 以前の日付は選択できません。10月2日以降を指定してください。</div>`;
        return;
    }

    if (!globalData) {
        loadingBox.style.display = "block";
        try {
            const response = await fetch(GAS_URL);
            globalData = await response.json();
            //console.log(globalData);
            loadingBox.style.display = "none";
        } catch (error) {
            loadingBox.style.display = "none";
            messageArea.innerHTML = `<div class="error-box">データの取得に失敗しました。<br><small>${error.message}</small></div>`;
            return;
        }
    }

    //運用ベース取得
    for(let i = 0; i < globalData.basevehicle.length; i++){
        const R = "R" + (i + 1);
        BASE_VEHICLES[R] = globalData.basevehicle[i]["車両"];
    }

    //休業期間指定優先
    const holidaysArray = Array.isArray(globalData) ? [] : (globalData.holidays || []);
    const matchedHoliday = checkIsHoliday(selectedDateStr, holidaysArray);

    if (matchedHoliday) {
        const type = matchedHoliday["種別"] || "特別ダイヤ";
        const reason = matchedHoliday["備考"] ? ` (${matchedHoliday["備考"]})` : "";

        if (type.includes("臨時")) {
            messageArea.innerHTML = `<div class="holiday-box" style="background:#e8f0fe; color:#1a73e8; border-color:#d2e3fc;">${targetDate.toLocaleDateString()} はイベント等の臨時ダイヤです。 ${reason} </div>`;
        } else if (type.includes("休業日")) {
            messageArea.innerHTML = `<div class="holiday-box" style="background:#fef7e0; color:#b06000; border-color:#fef1c7;">${targetDate.toLocaleDateString()} は休業日ダイヤです。 ${reason} </div>`;
        } else {
            messageArea.innerHTML = `<div class="holiday-box">${targetDate.toLocaleDateString()} は運休日です。 ${reason} </div>`;
        }
        return;
    }

    const dayOfWeek = targetDate.getDay();

    if (dayOfWeek === 0) { //日曜日
        messageArea.innerHTML = `<div class="holiday-box">${targetDate.toLocaleDateString()} は日曜日 (運休) です。</div>`;
        return;
    }

    if (dayOfWeek === 6) { //土曜日
        messageArea.innerHTML = `<div class="info-box" style="background:#fef7e0; color:#b06000; border-color:#fef1c7;">${targetDate.toLocaleDateString()} は土曜日ダイヤです。<br><small>※現在、土曜日ダイヤの運用データは未登録です。</small></div>`;
        return;
    }

    //通常期間
    let diffDays = countBusinessDays(BASE_DATE, targetDate, holidaysArray);
    messageArea.innerHTML = `<div class="info-box">選択日：<strong>${targetDate.toLocaleDateString()}</strong><br>この日の各運用と担当車両の割り当て予測です。</div>`;

    //ダイヤデータ
    const rawTimetables = Array.isArray(globalData) ? globalData : (globalData.timetables || []);
    rawTimetables.forEach(row => {
        const op = row["運用"];
        if (!op) return;
        if (!timetables[op]) timetables[op] = [];
        
        timetables[op].push({ //運用ごとのまとめ便
            time: extractTime(row["発車時刻"]),
            from: row["出発地"],
            to: row["到着地"],
            note: row["備考"]
        });

        if (row["出発地"] == "高坂" || row["到着地"] == "高坂"){ //高坂便
            TakasakaTables.push({
                number: op,
                time: extractTime(row["発車時刻"]),
                from: row["出発地"],
                to: row["到着地"],
                note: row["備考"]
            });
        }else if(row["出発地"] == "北坂戸" || row["到着地"] == "北坂戸"){ //北坂戸便
            KitasakadoTables.push({
                number: op,
                time: extractTime(row["発車時刻"]),
                from: row["出発地"],
                to: row["到着地"],
                note: row["備考"]
            });
        }else if(row["出発地"] == "熊谷" || row["到着地"] == "熊谷"){ //熊谷便
            KumagayaTables.push({
                number: op,
                time: extractTime(row["発車時刻"]),
                from: row["出発地"],
                to: row["到着地"],
                note: row["備考"]
            });
        }else { //鴻巣便
            KonosuTables.push({
                number: op,
                time: extractTime(row["発車時刻"]),
                from: row["出発地"],
                to: row["到着地"],
                note: row["備考"]
            });
        }
    });

    //カード生成
    let html = "";
    for (let i = 1; i <= 9; i++) {
        let origN = i + diffDays;
        while (origN > 9) origN -= 9;

        let opName = "R" + i;
        let baseOpName = "R" + origN;
        let assignedVehicle = BASE_VEHICLES[baseOpName];

        let runs = timetables[opName] || [];
        let runsHtml = "";
        if (runs.length > 0) {
            runsHtml = runs.map(r => `
                    <div>
                        <span>${r.time} ${r.from} ⇒ ${r.to}</span>
                        <span class="note">${r.note || ''}</span>
                    </div>
                `).join("");
        } else {
            runsHtml = `<div style="color:#996; text-align:center; padding:10px;">運行データなし</div>`;
        }

        html += `
                <div class="card">
                    <h3><span>${opName} 運用</span> <span class="badge">RO${assignedVehicle}号車</span></h3>
                    <div class="timetable">
                        ${runsHtml}
                    </div>
                </div>
            `;
    }
    grid.innerHTML = html;
}

//初期化
function init() {
    const dateInput = document.getElementById("target-date");

    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const todayStr = `${yyyy}-${mm}-${dd}`;

    if (parseDateString(todayStr) < BASE_DATE) {
        dateInput.value = "2026-10-02";
    } else {
        dateInput.value = todayStr;
    }

    dateInput.addEventListener("change", updateView);
    updateView();
}

init();

console.log("運用ごと",timetables);
console.log("高坂便",TakasakaTables);
console.log("北坂戸便",KitasakadoTables);
console.log("熊谷便",KumagayaTables);
console.log("鴻巣便",KonosuTables);