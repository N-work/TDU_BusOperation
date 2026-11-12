function timeToMinutes(timeStr) {
    if (!timeStr) return -1;
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
    }

function getNextRunIndex(runsList, currentMinutes) {
    let nextIdx = -1;
    let minDiff = Infinity;

    runsList.forEach((r, idx) => {
        const runMinutes = timeToMinutes(r.time);
        const diff = runMinutes - currentMinutes;
                
        if (diff > 0 && diff < minDiff) {
            minDiff = diff;
            nextIdx = idx;
        }
    });

    return nextIdx;
}

function generateRunsHtml(targetRuns, nextIdx, BASE_VEHICLES_RESULT) {
    let return_Idx = null;

    if (targetRuns.length === 0) {
        return `<div style="color:#996; text-align:center; padding:10px;">運行データなし</div>`;
    }

    return [targetRuns.map((r, idx) => {
        const isNext = (idx === nextIdx);
        const styleAttr = isNext ? 'style="background-color: pink; padding: 4px; border-radius: 4px;"' : '';
        if (isNext) return_Idx = {"time":r.time,"number":r.number,"car":BASE_VEHICLES_RESULT[r.number]};

        return `
            <div ${styleAttr}>
                <span>${r.time} ${r.from} ⇒ ${r.to}</span>
                <span>${r.number} : RO${BASE_VEHICLES_RESULT[r.number]}</span>
                <span class="note">${r.note || ''}</span>
            </div>
        `;
    }).join(""),return_Idx];
}

async function updateView() {
    const dateInput = document.getElementById("target-date");
    const messageArea = document.getElementById("message-area");
    const loadingBox = document.getElementById("loading");
    const grid = document.getElementById("assignment-grid");
    const Takasaka_Title = document.getElementById("TakasakaTitle");
    const grid_Takasaka = document.getElementById("assignment-grid-Takasaka");
    const Kitasakado_Title = document.getElementById("KitasakadoTitle");
    const grid_Kitasakado = document.getElementById("assignment-grid-Kitasakado");
    const Kumagaya_Title = document.getElementById("KumagayaTitle");
    const grid_Kumagaya = document.getElementById("assignment-grid-Kumagaya");
    const Konosu_Title = document.getElementById("KonosuTitle");
    const grid_Konosu = document.getElementById("assignment-grid-Konosu");
    const unyo_Title = document.getElementById("unyo");

    if (!grid) return;

    grid.innerHTML = "";
    if (grid_Takasaka) grid_Takasaka.innerHTML = "";

    const selectedDateStr = dateInput.value;
    if (!selectedDateStr) return;

    const targetDate = window.parseDateString(selectedDateStr);

    if (targetDate < window.BASE_DATE) {
        messageArea.innerHTML = `<div class="error-box">エラー: 基準日 (2026年10月2日) 以前の日付は選択できません。10月2日以降を指定してください。</div>`;
        return;
    }

    loadingBox.style.display = "block";
    try {
        await window.loadGlobalData();
        loadingBox.style.display = "none";
    } catch (error) {
        loadingBox.style.display = "none";
        messageArea.innerHTML = `<div class="error-box">データの取得に失敗しました。<br><small>${error.message}</small></div>`;
        return;
    }

    const globalData = window.globalData;
    const holidaysArray = Array.isArray(globalData) ? [] : (globalData.holidays || []);

    // 休業期間指定優先
    const matchedHoliday = window.checkIsHoliday(selectedDateStr, holidaysArray);
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
    }

    const dayOfWeek = targetDate.getDay();
    if (dayOfWeek === 0) { //日曜日
        messageArea.innerHTML = `<div class="holiday-box">${targetDate.toLocaleDateString()} は日曜日 (運休) です。</div>`;
    }
    if (dayOfWeek === 6) { //土曜日
        messageArea.innerHTML = `<div class="info-box" style="background:#fef7e0; color:#b06000; border-color:#fef1c7;">${targetDate.toLocaleDateString()} は土曜日ダイヤです。<br><small>※現在、土曜日ダイヤの運用データは未登録です。</small></div>`;
    }

    if(matchedHoliday || dayOfWeek == 0 || dayOfWeek == 6){
        grid.innerHTML = "";
        grid_Takasaka.innerHTML = "";
        grid_Kitasakado.innerHTML = "";
        grid_Kumagaya.innerHTML = "";
        grid_Konosu.innerHTML = "";
        Takasaka_Title.innerHTML = "";
        Kitasakado_Title.innerHTML = "";
        Kumagaya_Title.innerHTML = "";
        Konosu_Title.innerHTML = "";
        unyo.innerHTML = "";

        return;
    }

    // 通常期間
    let diffDays = window.countBusinessDays(window.BASE_DATE, targetDate, holidaysArray);
    messageArea.innerHTML = `<div class="info-box">選択日：<strong>${targetDate.toLocaleDateString()}</strong><br>この日の各運用と担当車両の割り当て予測です。</div>`;
    let BASE_VEHICLES_RESULT = window.RoyalNumberChange(diffDays);

    // カード生成(運用ごと)
    let html = "";
    for (let i = 1; i <= 9; i++) {
        let opName = "R" + i;
        let assignedVehicle = BASE_VEHICLES_RESULT[opName];

        let runs = window.timetables[opName] || [];
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
    unyo.innerHTML = "運用ごと";

    // 高坂便
    if (grid_Takasaka) {
        let takasakaRunsAll = window.TakasakaTables || [];

        const takasakaRuns = takasakaRunsAll.filter(r => r.from == '高坂');
        const universityRuns = takasakaRunsAll.filter(r => r.from == '大学');

        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();

        const nextTakasakaIdx = getNextRunIndex(takasakaRuns, currentMinutes);
        const nextUniversityIdx = getNextRunIndex(universityRuns, currentMinutes);

        let Takasaka_Univ = generateRunsHtml(takasakaRuns, nextTakasakaIdx, BASE_VEHICLES_RESULT);
        let Univ_Takasaka = generateRunsHtml(universityRuns, nextUniversityIdx, BASE_VEHICLES_RESULT);

        let Takasaka_Univ_show = Takasaka_Univ[1] ? `次の便 ${Takasaka_Univ[1].time} RO${Takasaka_Univ[1].car}号車(${Takasaka_Univ[1].number}運用)` : "次の便はありません";
        let Univ_Takasaka_show = Univ_Takasaka[1] ? `次の便 ${Univ_Takasaka[1].time} RO${Univ_Takasaka[1].car}号車(${Univ_Takasaka[1].number}運用)` : "次の便はありません";

        grid_Takasaka.innerHTML = `
            <div class="card">
                <h3><span>高坂 ⇒ 大学</span><span class="badge">${Takasaka_Univ_show}</span></h3>
                <div class="timetable">
                    ${Takasaka_Univ[0]}
                </div>
            </div>
            
            <div class="card">
                <h3><span>大学 ⇒ 高坂</span><span class="badge">${Univ_Takasaka_show}</span></h3>
                <div class="timetable">
                    ${Univ_Takasaka[0]}
                </div>
            </div>
        `;

        Takasaka_Title.innerHTML = '高坂便'
    }

    // 北坂戸便
    if (grid_Kitasakado) {
        let kitasakadoRunsAll = window.KitasakadoTables || [];

        const kitasakadoRuns = kitasakadoRunsAll.filter(r => r.from == '北坂戸');
        const universityRuns = kitasakadoRunsAll.filter(r => r.from == '大学');

        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();

        const nextKitasakadoIdx = getNextRunIndex(kitasakadoRuns, currentMinutes);
        const nextUniversityIdx = getNextRunIndex(universityRuns, currentMinutes);
        
        let Kitasakado_Univ = generateRunsHtml(kitasakadoRuns, nextKitasakadoIdx, BASE_VEHICLES_RESULT);
        let Univ_Kitasakado = generateRunsHtml(universityRuns, nextUniversityIdx, BASE_VEHICLES_RESULT);

        let Kitasakado_Univ_show = Kitasakado_Univ[1] ? `次の便 ${Kitasakado_Univ[1].time} RO${Kitasakado_Univ[1].car}号車(${Kitasakado_Univ[1].number}運用)` : "次の便はありません";
        let Univ_Kitasakado_show = Univ_Kitasakado[1] ? `次の便 ${Univ_Kitasakado[1].time} RO${Univ_Kitasakado[1].car}号車(${Univ_Kitasakado[1].number}運用)` : "次の便はありません";

        grid_Kitasakado.innerHTML = `
            <div class="card">
                <h3><span>北坂戸 ⇒ 大学</span><span class="badge">${Kitasakado_Univ_show}</span></h3>
                <div class="timetable">
                    ${Kitasakado_Univ[0]}
                </div>
            </div>
            
            <div class="card">
                <h3><span>大学 ⇒ 北坂戸</span><span class="badge">${Univ_Kitasakado_show}</span></h3>
                <div class="timetable">
                    ${Univ_Kitasakado[0]}
                </div>
            </div>
        `;

        Kitasakado_Title.innerHTML = '北坂戸便'
    }

     // 熊谷便
    if (grid_Kumagaya) {
        let KumagayaRunsAll = window.KumagayaTables || [];

        const KumagayaRuns = KumagayaRunsAll.filter(r => r.from == '熊谷');
        const universityRuns = KumagayaRunsAll.filter(r => r.from == '大学');

        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();

        const nextKumagayaIdx = getNextRunIndex(KumagayaRuns, currentMinutes);
        const nextUniversityIdx = getNextRunIndex(universityRuns, currentMinutes);

        let Kumagaya_Univ = generateRunsHtml(KumagayaRuns, nextKumagayaIdx, BASE_VEHICLES_RESULT);
        let Univ_Kumagaya = generateRunsHtml(universityRuns, nextUniversityIdx, BASE_VEHICLES_RESULT);

        let Kumagaya_Univ_show = Kumagaya_Univ[1] ? `次の便 ${Kumagaya_Univ[1].time} RO${Kumagaya_Univ[1].car}号車(${Kumagaya_Univ[1].number}運用)` : "次の便はありません";
        let Univ_Kumagaya_show = Univ_Kumagaya[1] ? `次の便 ${Univ_Kumagaya[1].time} RO${Univ_Kumagaya[1].car}号車(${Univ_Kumagaya[1].number}運用)` : "次の便はありません";

        grid_Kumagaya.innerHTML = `
            <div class="card">
                <h3><span>熊谷 ⇒ 大学</span><span class="badge">${Kumagaya_Univ_show}</span></h3>
                <div class="timetable">
                    ${Kumagaya_Univ[0]}
                </div>
            </div>
            
            <div class="card">
                <h3><span>大学 ⇒ 熊谷</span><span class="badge">${Univ_Kumagaya_show}</span></h3>
                <div class="timetable">
                    ${Univ_Kumagaya[0]}
                </div>
            </div>
        `;

        Kumagaya_Title.innerHTML = '熊谷便'
    }

     // 鴻巣便
    if (grid_Konosu) {
        let KonosuRunsAll = window.KonosuTables || [];

        const KonosuRuns = KonosuRunsAll.filter(r => r.from == '鴻巣');
        const universityRuns = KonosuRunsAll.filter(r => r.from == '大学');

        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();

        const nextKonosuIdx = getNextRunIndex(KonosuRuns, currentMinutes);
        const nextUniversityIdx = getNextRunIndex(universityRuns, currentMinutes);

        let Konosu_Univ = generateRunsHtml(KonosuRuns, nextKonosuIdx, BASE_VEHICLES_RESULT);
        let Univ_Konosu = generateRunsHtml(universityRuns, nextUniversityIdx, BASE_VEHICLES_RESULT);

        let Konosu_Univ_show = Konosu_Univ[1] ? `次の便 ${Konosu_Univ[1].time} RO${Konosu_Univ[1].car}号車(${Konosu_Univ[1].number}運用)` : "次の便はありません";
        let Univ_Konosu_show = Univ_Konosu[1] ? `次の便 ${Univ_Konosu[1].time} RO${Univ_Konosu[1].car}号車(${Univ_Konosu[1].number}運用)` : "次の便はありません";

        grid_Konosu.innerHTML = `
            <div class="card">
                <h3><span>鴻巣 ⇒ 大学</span><span class="badge">${Konosu_Univ_show}</span></h3>
                <div class="timetable">
                    ${Konosu_Univ[0]}
                </div>
            </div>
            
            <div class="card">
                <h3><span>大学 ⇒ 鴻巣</span><span class="badge">${Univ_Konosu_show}</span></h3>
                <div class="timetable">
                    ${Univ_Konosu[0]}
                </div>
            </div>
        `;

        Konosu_Title.innerHTML = '鴻巣便'
    }
}

// 初期化
function init() {
    const dateInput = document.getElementById("target-date");
    if (!dateInput) return;

    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const todayStr = `${yyyy}-${mm}-${dd}`;

    if (window.parseDateString(todayStr) < window.BASE_DATE) {
        dateInput.value = "2026-10-02";
    } else {
        dateInput.value = todayStr;
    }

    dateInput.addEventListener("change", updateView);
    updateView();
}

init();