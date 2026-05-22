let inputText = ""; // 入力された語形
let displayNum = 0; // 表示する意味の行番号（切り替えることで別の意味を表示できる）
let lemma_list = []; // 取得した原形
let dataArray = []; // ファイルのデータ
let dictionary = {};
let t = key => key;
let lang_int = 0;

const labels = [
  "V", "PRS", "PST", "POL", "FOREG", "NEG", "PROSP", "INTEN", "1", "3",
  "IMP", "OBLIG", "POT", "PASS", "CAUS", "FORM", "ELEV", "HUMB", "PERM", "COL"
];

const DATA_URL = "https://raw.githubusercontent.com/cl-tohoku/J-UniMorph/main/jpn_for_inflection_tool.txt";
const SUGGESTION_LIMIT = 10;

let exactIndex = new Map();       // key: inflected / hiragana / romanized form, value: rows[]
let lemmaLabelIndex = new Map();  // key: lemma\tlabelSignature, value: rows[]
let suggestionCandidates = [];    // [{ value, hits }], sorted by hits desc

function calcConfidence(getHitsStr) {
  const getHitsInt = parseInt(String(getHitsStr || "0").replace(/,/g, ""), 10) || 0;
  const maxHits = 3370000000; // 「する」のヒット数が最大
  const logScaleHits = Math.log10(getHitsInt + 1) / Math.log10(maxHits + 1) * 100;
  return logScaleHits.toFixed(2);
}

function num2comma(numStr) {
  return Number(numStr).toLocaleString();
}

function safeText(key, fallback = "") {
  if (dictionary.translation && dictionary.translation[key] != null) return dictionary.translation[key];
  if (dictionary.innerText && dictionary.innerText[key] != null) return dictionary.innerText[key];
  return fallback || key;
}

function getElement(id) {
  return document.getElementById(id);
}

function checkOnOff(inLabel, outLabels, inInt, outInt) {
  const inElement = getElement(`chk_${inLabel}`);
  if (!inElement) return;

  const flag = inInt === 1;
  inElement.addEventListener("change", function () {
    if (inElement.checked === flag) {
      outLabels.forEach(label => {
        const outElement = getElement(`chk_${label}`);
        if (outElement) outElement.checked = outInt === 1;
      });
    }
  });
}

function labelSignature(labelsArray) {
  return labelsArray.slice().sort().join(";");
}

function addToMultiMap(map, key, row) {
  if (!key) return;
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(row);
}

function buildIndexes(rows) {
  exactIndex = new Map();
  lemmaLabelIndex = new Map();

  const suggestionMap = new Map();

  for (const row of rows) {
    if (!row || row.length < 8) continue;

    // 完全一致検索用: row[1] = 表記, row[5] = ひらがな, row[7] = ローマ字
    addToMultiMap(exactIndex, row[1], row);
    addToMultiMap(exactIndex, row[5], row);
    addToMultiMap(exactIndex, row[7], row);

    const lemma = row[0];
    const labelsStr = row[2] || "";
    const lemmaKey = `${lemma}\t${labelSignature(labelsStr.split(";"))}`;
    addToMultiMap(lemmaLabelIndex, lemmaKey, row);

    // 予測補完候補。表示形・ひらがな・ローマ字を候補に含める。
    for (const value of [row[1], row[5], row[7]]) {
      if (!value) continue;
      const hits = parseInt(String(row[3] || "0").replace(/,/g, ""), 10) || 0;
      if (!suggestionMap.has(value) || suggestionMap.get(value) < hits) {
        suggestionMap.set(value, hits);
      }
    }
  }

  suggestionCandidates = Array.from(suggestionMap, ([value, hits]) => ({ value, hits }))
    .sort((a, b) => b.hits - a.hits || a.value.localeCompare(b.value, "ja"));
}

function getExactRows(query) {
  const rows = exactIndex.get(query) || [];
  // row[1], row[5], row[7] の重複ヒットを除去する。
  return Array.from(new Set(rows));
}

function updateSuggestions(query = "") {
  const dataset = getElement("dataset");
  if (!dataset) return;

  const q = query.trim();
  const lowerQ = q.toLowerCase();
  const fragment = document.createDocumentFragment();
  let count = 0;

  dataset.innerHTML = "";

  for (const candidate of suggestionCandidates) {
    const value = candidate.value;
    const normalizedValue = value.toLowerCase();

    // 空欄時は頻度上位10件を表示する。入力時は前方一致を優先し、候補数を10件に制限する。
    if (!q || value.startsWith(q) || normalizedValue.startsWith(lowerQ)) {
      const option = document.createElement("option");
      option.value = value;
      fragment.appendChild(option);
      count += 1;
      if (count >= SUGGESTION_LIMIT) break;
    }
  }

  // 前方一致で10件に満たない場合だけ部分一致も補う。
  if (q && count < SUGGESTION_LIMIT) {
    const existing = new Set(Array.from(fragment.children).map(option => option.value));
    for (const candidate of suggestionCandidates) {
      const value = candidate.value;
      const normalizedValue = value.toLowerCase();
      if (existing.has(value)) continue;
      if (value.includes(q) || normalizedValue.includes(lowerQ)) {
        const option = document.createElement("option");
        option.value = value;
        fragment.appendChild(option);
        count += 1;
        if (count >= SUGGESTION_LIMIT) break;
      }
    }
  }

  dataset.appendChild(fragment);
}

function clearCheckboxes() {
  labels.forEach(label => {
    const checkbox = getElement(`chk_${label}`);
    if (!checkbox) return;
    checkbox.checked = false;
    checkbox.setAttribute("pattern", "out");
  });
}

function displayNoMatch() {
  getElement("resultDisplayError").innerHTML = safeText("noMatchError", "該当する語がありません。別の語を試してください。");
  getElement("resultDisplay").innerHTML = "";
  clearCheckboxes();
}

function displayResult(currentDisplayNum, rows, query, labels, mode) {
  getElement("resultDisplayError").innerHTML = "";
  getElement("resultDisplay").innerHTML = "";
  getElement("relatedWords").innerText = "";
  getElement("changedRelatedWords").innerHTML = dictionary.innerText?.changedRelatedWords || "";

  const matchingRows = getExactRows(query);

  if (matchingRows.length === 0) {
    displayNoMatch();
    return 0;
  }

  let nextDisplayNum = currentDisplayNum;
  if (mode === "search") {
    nextDisplayNum = 0;
  } else if (mode === "change") {
    nextDisplayNum = (nextDisplayNum + 1) % matchingRows.length;
  } else if (Number.isInteger(mode)) {
    nextDisplayNum = mode;
  }

  const selectedRow = matchingRows[nextDisplayNum];
  if (!selectedRow) {
    displayNoMatch();
    return 0;
  }

  const lemma = selectedRow[0];
  const hitLabels = (selectedRow[2] || "").split(";");

  lemma_list = matchingRows.map(row => row[0]);

  const matchingRowsForDisplay = matchingRows.map((row, index) =>
    `${index + 1}: ${row[0]}/ ${row[6]}<br>${row[1]}/ ${row[7]}<br>${row[2]}`
  );

  let resultDisplay = "";
  for (let i = 0; i < matchingRowsForDisplay.length; i++) {
    const checked = i === nextDisplayNum ? "checked" : "";
    resultDisplay += `<input type="radio" name="resultRadio" onclick="changeDisplayResultByRadio(${i})" ${checked}> ${matchingRowsForDisplay[i]}<br><br>`;
  }
  getElement("resultDisplay").innerHTML = resultDisplay;

  clearCheckboxes();
  hitLabels.forEach(label => {
    if (label === "IPFV" || label === "PFV" || label === "OPT") return;
    const checkbox = getElement(`chk_${label}`);
    if (!checkbox) return;
    checkbox.checked = true;
    checkbox.setAttribute("pattern", "in");
  });

  const retrievalKey = `${lemma}\t${labelSignature(hitLabels)}`;
  const retrievalResult = (lemmaLabelIndex.get(retrievalKey) || []).slice();
  retrievalResult.sort((row1, row2) => Number(row2[3]) - Number(row1[3]));

  const relatedWordsForDisplay = retrievalResult.map(row => `${row[1]}/ ${row[7]} (${calcConfidence(row[3])})`);
  getElement("relatedWords").innerText = relatedWordsForDisplay.join("\n");

  return nextDisplayNum;
}

function changeDisplayResultByRadio(id) {
  inputText = getElement("inputText").value;
  displayNum = displayResult(displayNum, dataArray, inputText, labels, id);
}

const format = (str, ...args) => {
  let result = str || "";
  for (const [i, arg] of args.entries()) {
    const regExp = new RegExp(`\\{${i}\\}`, "g");
    result = result.replace(regExp, arg);
  }
  return result;
};

async function load_json(lang) {
  const jsonPath = `dictionary/${lang}.json`;
  const response = await fetch(jsonPath, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to fetch dictionary: ${response.status} ${response.statusText}`);
  }
  const data = await response.json();
  dictionary = data;
  init_language(data);
  t = translator(data);
  return data;
}

function init_language(dictionary) {
  for (const key in dictionary.innerText || {}) {
    const element = getElement(key);
    if (element != null) element.innerText = dictionary.innerText[key];
  }
  for (const key in dictionary.placeholder || {}) {
    const element = getElement(key);
    if (element != null) element.setAttribute("placeholder", dictionary.placeholder[key]);
  }
  for (const key in dictionary.href || {}) {
    const element = getElement(key);
    if (element != null) element.setAttribute("href", dictionary.href[key]);
  }
}

function translator(dictionary) {
  return function translate(key) {
    return dictionary.translation?.[key] || key;
  };
}

function setLoadingStatus(message) {
  const loadingStatus = getElement("loadingStatus");
  if (loadingStatus) loadingStatus.innerText = message;
}

async function loadData() {
  const response = await fetch(DATA_URL, { cache: "force-cache" });
  if (!response.ok) {
    throw new Error(`Failed to fetch txt file: ${response.status} ${response.statusText}`);
  }

  const csvData = await response.text();
  const lines = csvData.split("\n").filter(line => line.trim() !== "");
  dataArray = lines.map(line => line.trim().split("\t"));

  // 1行目はヘッダとして扱う。
  const dataArrayMain = dataArray.slice(1);
  buildIndexes(dataArrayMain);
  updateSuggestions("");
}

function addEventListeners() {
  const inputElement = getElement("inputText");

  inputElement.addEventListener("input", function () {
    updateSuggestions(inputElement.value);
  });

  inputElement.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      if (inputText === inputElement.value) {
        getElement("changeBtn").click();
      } else {
        getElement("searchButton").click();
      }
    }
  });

  getElement("searchButton").addEventListener("click", function () {
    inputText = inputElement.value.trim();
    displayNum = displayResult(displayNum, dataArray, inputText, labels, "search");
  });

  getElement("changeBtn").addEventListener("click", function () {
    inputText = inputElement.value.trim();
    displayNum = displayResult(displayNum, dataArray, inputText, labels, "change");
  });

  const chkV = getElement("chk_V");
  if (chkV) {
    chkV.addEventListener("change", function () {
      chkV.checked = true;
    });
  }

  checkOnOff("PRS", ["PST", "INTEN"], 1, 0);
  checkOnOff("PST", ["PRS", "INTEN"], 1, 0);
  checkOnOff("INTEN", ["PRS", "PST"], 1, 0);
  checkOnOff("ELEV", ["HUMB"], 1, 0);
  checkOnOff("HUMB", ["ELEV"], 1, 0);
  checkOnOff("HUMB", ["FORM"], 1, 1);
  checkOnOff("FORM", ["ELEV", "HUMB"], 0, 0);
  checkOnOff("FOREG", ["POL"], 1, 1);
  checkOnOff("POL", ["FOREG"], 0, 0);
  checkOnOff("1", ["3"], 1, 0);
  checkOnOff("3", ["1"], 1, 0);

  labels.forEach(label => {
    const checkbox = getElement(`chk_${label}`);
    if (!checkbox) return;

    checkbox.addEventListener("change", function () {
      try {
        const lemma = lemma_list[displayNum];
        if (!lemma) throw new Error("Lemma is not selected.");

        const checkedLabels = labels.filter(label => getElement(`chk_${label}`)?.checked);
        if (checkedLabels.includes("PRS")) checkedLabels.push("IPFV");
        if (checkedLabels.includes("PST")) checkedLabels.push("PFV");
        if (checkedLabels.includes("1") || checkedLabels.includes("3")) checkedLabels.push("OPT");

        const checkedLabelsStr = checkedLabels.join(";");
        const retrievalKey = `${lemma}\t${labelSignature(checkedLabels)}`;
        const matchingRows = (lemmaLabelIndex.get(retrievalKey) || []).slice();
        matchingRows.sort((row1, row2) => Number(row2[3]) - Number(row1[3]));

        const relatedWordsForDisplay = matchingRows.map(row => `${row[1]}/ ${row[7]} (${calcConfidence(row[3])})`);
        let displayRelated = format(t("changedWordsLabel"), lemma, checkedLabelsStr);
        if (relatedWordsForDisplay.length === 0) {
          displayRelated += t("noMatchingChangeError");
        }
        getElement("changedRelatedWords").innerText = displayRelated + relatedWordsForDisplay.join("\n");
      } catch (error) {
        console.error(error);
        getElement("changedRelatedWords").innerText = t("error");
      }
    });
  });
}

window.onload = async function () {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const lang = urlParams.get("lang") || "ja";
    lang_int = lang === "en" ? 1 : 0;

    setLoadingStatus(lang_int === 1 ? "Loading data..." : "データを読み込んでいます...");
    await load_json(lang);
    await loadData();
    addEventListeners();
    setLoadingStatus("");
  } catch (error) {
    console.error(error);
    const messageJa = "初期化に失敗しました。ページを再読み込みしてください。";
    const messageEn = "Failed to initialize the visualizer. Please reload the page.";
    setLoadingStatus(lang_int === 1 ? messageEn : messageJa);
    const resultDisplayError = getElement("resultDisplayError");
    if (resultDisplayError) resultDisplayError.innerText = `${lang_int === 1 ? messageEn : messageJa}\n${error.message}`;
  }
};
