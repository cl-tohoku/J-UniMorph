let inputText = ""; // 入力された語形
let displayNum = 0; // 表示する意味の行番号（切り替えることで別の意味を表示できる）
let lemma_list = []; // 取得した原形
let dataArray = []; // ファイルのデータ
const labels = ['V', 'PRS', 'PST', 'POL', 'FOREG', 'NEG', 'PROSP',
    'INTEN', '1', '3', 'IMP', 'OBLIG', 'POT', 'PASS', 'CAUS',
    'FORM', 'ELEV', 'HUMB', 'PERM', 'COL'];
let lang_int = 0
let dictionary = {};


function calcConfidence(getHitsStr) {
    // 検索ヒット数を用いてヒット指数を計算する
    const getHitsInt = parseInt(getHitsStr.replace(/,/g, ''));
    const maxHits = 3370000000;  // 「する」のヒット数が最大
    const logScaleHits = Math.log10(getHitsInt + 1) / Math.log10(maxHits + 1) * 100;
    return logScaleHits.toFixed(2);
}

function num2comma(numStr) {
    // String型の数値を3桁ごとにカンマ区切りにする
    comma = Number(numStr).toLocaleString();
    return comma;
}

function checkOnOff(inLabel, outLabels, inInt, outInt) {
    // inLabelのチェックボックスがX1になったら，outLabelsのチェックボックスをX2にする
    // ただし，X1: inIntが1のときON，0のときOFF，X2: outIntが1のときON，0のときOFF
    let flag = false;
    if (inInt == 1) {
        flag = true;
    }
    document.getElementById(`chk_${inLabel}`).addEventListener('change', function () {
        if (document.getElementById(`chk_${inLabel}`).checked == flag) {
            outLabels.forEach(label => {
                if (outInt == 1) {
                    document.getElementById(`chk_${label}`).checked = true;
                } else {
                    document.getElementById(`chk_${label}`).checked = false;
                }
            });
        }
    });
}

function displayResult(displayNum, dataArray, inputText, labels, mode, lang_int) {
    // ボタンを押したあとの処理をまとめて関数化
    let matchingRows;
    let lemma;
    let hits;
    let confidence;
    let retrieval_num = 0; // 該当した件数
    let hitsAndConfidence;
    let matchingRowsForDisplay;
    document.getElementById("resultDisplayError").innerHTML = "";
    document.getElementById("resultDisplay").innerHTML = "";
    document.getElementById("relatedWords").innerText = "";
    document.getElementById("changedRelatedWords").innerHTML = dictionary["innerText"]["changedRelatedWords"];
    try {
        // 入力値と一致する行のフィルタリング（完全一致）
        matchingRows = dataArray.filter(row => row[1] === inputText);
        console.log(inputText);
        if (mode == "search") {
            displayNum = 0;
        } else if (mode == "change") {
            displayNum = (displayNum + 1) % matchingRows.length; // 意味表示の行番号を更新
        } else {
            displayNum = mode;
        }

        // 表示のために，1列目と3列目だけ残す．加えて，1列目の左側に行番号を追加する
        // 例：['1: 行く V;PRS;IPFV;POT', '2: 来る V;PRS;IPFV;POT']
        lemma = matchingRows[displayNum][0]; // 原形
    } catch (error) {
        console.log(error);
        let resultDisplay = "";
        resultDisplay += t("noMatchError");
        document.getElementById("resultDisplayError").innerHTML = resultDisplay;
        document.getElementById("resultDisplay").innerHTML = "";
        // document.getElementById("result").innerText = ["該当する語がありません．他の語を試してみてください．", "No match found. Please try another word."][lang_int];
        // チェックボックスの状態をリセット
        labels.forEach(label => {
            document.getElementById(`chk_${label}`).checked = false;
            document.getElementById(`chk_${label}`).setAttribute("pattern", "out");
        });
        // document.getElementById("result-display").innerText = ["検索結果がここに表示されます", "Your search results will be displayed here."][lang_int];
        // document.getElementById("relateed-words").innerText = ["関連語がここに表示されます", "Related words will be displayed here."][lang_int];
        return 0;
    }
    lemma_list = matchingRows.map(row => row[0]); // 原形のリスト
    hits = matchingRows[displayNum][3]; // ヒット件数
    confidence = calcConfidence(hits); // ヒット指数
    hitsAndConfidence = [``, ``][lang_int];
    //hitsAndConfidence += `ヒット件数: ${num2comma(hits)}，ヒット指数: ${confidence}`;
    hitsAndConfidence += `${t("confidence")}: ${confidence}`;
    matchingRowsForDisplay = matchingRows.map((row, index) => `${index + 1}: ${row[0]} ${row[2]}`);
    retrieval_num = matchingRows.length;
    // let add_message = "";
    // if(retrieval_num == 1 && mode == "change"){
    //     add_message = ["　　※他の意味はありません．", "    *No other meanings."][lang_int];
    // }
    // let message = [`「${inputText}」には${retrieval_num}件の意味が存在します．  表示中：${(displayNum + 1)} / ${retrieval_num}`,
    //                 `There are ${retrieval_num} meanings for "${inputText}".   Displaying: ${(displayNum + 1)} / ${retrieval_num}`][lang_int];
    // document.getElementById("result").innerText = message + "\nLemma: " + lemma + add_message;

    // 結果の表示
    // document.getElementById("resultDisplay").innerText = hitsAndConfidence + "\n" + matchingRowsForDisplay.join('\n');
    // make result in radio button
    let resultDisplay = "";
    resultDisplay += `<p>Lemma: ${lemma}</p>`;
    for (let i = 0; i < matchingRowsForDisplay.length; i++) {
        resultDisplay += `<div class="form-check col-12">`;
        if (i == displayNum) {
            resultDisplay += `<input type="radio" name="result" value=${i} id="result_${i}" class="form-check-input" checked>`;
        } else {
            resultDisplay += `<input type="radio" name="result" value=${i} id="result_${i}" class="form-check-input" onclick="changeDisplayResultByRadio(${i})">`;
        }
        resultDisplay += `<label for="result_${i}" class="form-check-label"> ${matchingRowsForDisplay[i]}</label>`;
        resultDisplay += `</div>`;
    }
    document.getElementById("resultDisplay").innerHTML = resultDisplay;



    // チェックボックスの状態を更新
    const hit_labels = matchingRows[displayNum][2].split(';'); // 例：['V', 'PRS', 'IPFV', 'POT']

    // 一旦全てのチェックボックスをOFFにする
    labels.forEach(label => {
        document.getElementById(`chk_${label}`).checked = false;
        document.getElementById(`chk_${label}`).setAttribute("pattern", "out");
    });
    //document.getElementById(`myCheckbox1`).pattern = 'out';

    // 一致するラベルのチェックボックスをONにする
    hit_labels.forEach(label => {
        if (label == "IPFV" || label == "PFV" || label == "OPT") {
            return;
        }
        document.getElementById(`chk_${label}`).checked = true;
        document.getElementById(`chk_${label}`).setAttribute("pattern", "in");
    });

    // 関連語（同じラベルを持つ語）の表示（;で区切られたラベルは順不同である）
    const retrievalResult = dataArray.filter(row => row[0] === lemma &&
        row[2].split(';').sort().join(";") === hit_labels.sort().join(";"));
    // retrievalResultを，ヒット指数の降順にソートしてから表示する
    retrievalResult.sort((row1, row2) => row2[3] - row1[3]);
    const relatedWordsForDisplay = retrievalResult.map(row => `${row[1]} (${calcConfidence(row[3])})`);
    //const displayRelated = `＜「${lemma} ${hit_labels}」である語＞\n`;
    const displayRelated = "";
    // const displayRelated = [`＜関連語＞\n`, `<Related words>\n`][lang_int];
    document.getElementById('relatedWords').innerText = displayRelated + relatedWordsForDisplay.join('\n');

    return displayNum;
}

// 意味表示切替ラジオボタンのクリックイベントリスナー
function changeDisplayResultByRadio(id) {
    inputText = document.getElementById("inputText").value;
    if (inputText == "") {
        inputText = document.getElementById("inputText_en").value;
    }
    // document.getElementById("result").innerText = "Input text: " + inputText;

    displayNum = displayResult(displayNum, dataArray, inputText, labels, id, lang_int);
}

const format = (str, ...args) => {
    for (const [i, arg] of args.entries()) {
        const regExp = new RegExp(`\\{${i}\\}`, 'g')
        str = str.replace(regExp, arg)
    }
    return str
}




// load json
async function load_json(lang) {
    json_path = `dictionary/${lang}.json`;
    fetch(json_path)
        .then(response => response.json())
        .then(data => {
            console.log(data);
            dictionary = data;
            init_language(data);
            t = translator(data);
            return data;
        });
}

// init lang
function init_language(dictionary) {
    for (var key in dictionary["innerText"]) {
        // check if document has element
        var element = document.getElementById(key);
        if (element != null) {
            element.innerText = dictionary["innerText"][key];
        }
    }

    for (var key in dictionary["placeholder"]) {
        // check if document has element
        var element = document.getElementById(key);
        if (element != null) {
            element.setAttribute("placeholder", dictionary["placeholder"][key]);
        }
    }
    for (var key in dictionary["href"]) {
        // check if document has element
        var element = document.getElementById(key);
        if (element != null) {
            element.setAttribute("href", dictionary["href"][key]);
        }
    }
}

function translator(dictionary) {
    function t(key) {
        return dictionary["translation"][key];
    }
    return t;
}




window.onload = async function () {
    // 説明
    //document.getElementById("description").innerText = "語形を入力して「検索」ボタンを押してください．例：走りません，いらっしゃった，食べられる";

    // URLから言語情報を取得
    const urlParams = new URLSearchParams(window.location.search);
    const lang = urlParams.get('lang') || "ja";  // 言語情報 'ja' or 'en'
    dictionary = await load_json(lang);
    console.log(lang);
    let lang_int = 0;
    if (lang == 'en') {
        lang_int = 1;  // 英語なら1，それ以外なら0
    }


    // ファイルのパス
    // document.getElementById("result").innerText = "";
    // ローカルにはアクセスできない（セキュリティ上の理由）
    //const filePath = 'file:///Users/~~~/Desktop/~~~/dataset/Japanese.txt';
    const filePath = 'https://raw.githubusercontent.com/cl-tohoku/J-UniMorph/main/jap_with_hits.txt'

    // ファイルを読み込み
    const response = await fetch(filePath);
    if (!response.ok) {
        throw new Error(`Failed to fetch txt file: ${response.status} ${response.statusText}`);
    }
    const csvData = await response.text();
    const lines = csvData.split('\n');
    dataArray = lines.map(line => line.trim().split('\t'));

    // Inflected formのみをリストに格納
    const dataArrayMain = dataArray.slice(1);
    const inflectedForms = dataArrayMain.map(data => data[1])
    const dataset = document.getElementById("dataset");
    for (const data of inflectedForms) {
        const option = document.createElement("option");
        option.value = data;
        dataset.appendChild(option);
    }



    // document.getElementById("resultDisplay").innerText = ["検索結果がここに表示されます", "Your search results will be displayed here."][lang_int]
    // document.getElementById("relateWords").innerText = ["関連語がここに表示されます", "Related words will be displayed here."][lang_int]
    // document.getElementById("changedRelateWords").innerText = 
    //     ["検索後にチェックボックスを変更すると，その意味の語形がここに表示されます．", 
    //      "If you change the checkbox after searching, the word form of the meaning will be displayed here."][lang_int]


    // チェックボックスのラベル
    //const labels = ['V', 'PRS', 'IPFV', 'PST', 'PFV', 'POL', 'FOREG', 'NEG', 'PROSP',
    //               'INTEN', 'OPT', '1', '3', 'IMP', 'OBLIG', 'POT', 'PASS', 'CAUS',
    //               'FORM', 'ELEV', 'HUMB', 'PERM', 'COL'];
    // const labels = ['V', 'PRS', 'PST', 'POL', 'FOREG', 'NEG', 'PROSP',
    //               'INTEN', '1', '3', 'IMP', 'OBLIG', 'POT', 'PASS', 'CAUS',
    //               'FORM', 'ELEV', 'HUMB', 'PERM', 'COL'];


    // Enterキーで検索ボタンを押せるようにする
    document.getElementById("inputText").addEventListener("keypress", function (e) {
        // ただし，入力内容が既存のものと一致していれば「別の意味を表示」ボタンを押したことにする
        if (e.key === "Enter") {
            if (inputText == document.getElementById("inputText").value) {
                document.getElementById("changeBtn").click();
            } else {
                document.getElementById("searchButton").click();
            }
        }
    });

    // 検索ボタンのクリックイベントリスナー
    document.getElementById("searchButton").addEventListener("click", function () {
        inputText = document.getElementById("inputText").value;
        // document.getElementById("result").innerText = "Input text: " + inputText;

        displayNum = displayResult(displayNum, dataArray, inputText, labels, "search", lang_int);
    });

    // 意味表示切り替えボタンのクリックイベントリスナー
    document.getElementById("changeBtn").addEventListener("click", function () {
        // 上の処理からdisplayNumの値を変えるだけ
        inputText = document.getElementById("inputText").value;
        if (inputText == "") {
            inputText = document.getElementById("inputText_en").value;
        }
        // document.getElementById("result").innerText = "Input text: " + inputText;

        displayNum = displayResult(displayNum, dataArray, inputText, labels, "change", lang_int);
    });


    // チェックが変更されたときの処理（例外対応）
    // Vは常にONにする
    document.getElementById("chk_V").addEventListener('change', function () {
        document.getElementById("chk_V").checked = true;
    });
    // PRSがONになったら，PSTとINTENはOFFにする
    checkOnOff("PRS", ["PST", "INTEN"], 1, 0);
    // PSTがONになったら，PRSとINTENはOFFにする
    checkOnOff("PST", ["PRS", "INTEN"], 1, 0);
    // INTENがONになったら，PRSとPSTはOFFにする
    checkOnOff("INTEN", ["PRS", "PST"], 1, 0);
    // ELEVがONになったら，HUMBはOFFにする
    checkOnOff("ELEV", ["HUMB"], 1, 0);
    // HUMBがONになったら，ELEVはOFFに，FORMはONにする
    checkOnOff("HUMB", ["ELEV"], 1, 0);
    checkOnOff("HUMB", ["FORM"], 1, 1);
    // FORMがOFFになったら，ELEVとHUMBはOFFにする
    checkOnOff("FORM", ["ELEV", "HUMB"], 0, 0);
    // FOREGがONになったら，POLはONにする
    checkOnOff("FOREG", ["POL"], 1, 1);
    // POLがOFFになったら，FOREGはOFFにする
    checkOnOff("POL", ["FOREG"], 0, 0);
    // 1がONになったら，3はOFFにする
    checkOnOff("1", ["3"], 1, 0);
    // 3がONになったら，1はOFFにする
    checkOnOff("3", ["1"], 1, 0);


    // チェックボックスの状態が変更された時のイベントリスナー
    labels.forEach(label => {
        document.getElementById(`chk_${label}`).addEventListener('change', function () {
            try {
                lemma = lemma_list[displayNum]; // 原形
                // チェックボックスがONになっているラベルを取得
                const checkedLabels = labels.filter(label => document.getElementById(`chk_${label}`).checked);
                // checkedLabelsに"PRS"が含まれている場合"IPFV"を追加し，"PST"が含まれている場合"PFV"を追加
                if (checkedLabels.includes("PRS")) {
                    checkedLabels.push("IPFV");
                }
                if (checkedLabels.includes("PST")) {
                    checkedLabels.push("PFV");
                }
                // checkedLabelsに"1"か"3"が含まれている場合"OPT"を追加
                if (checkedLabels.includes("1") || checkedLabels.includes("3")) {
                    checkedLabels.push("OPT");
                }
                console.log(checkedLabels);
                const checkedLabelsStr = checkedLabels.join(';');
                // 原形がlemmaで，ラベルがcheckedLabelsと一致する行を取得
                const matchingRows = dataArray.filter(row => row[0] === lemma &&
                    row[2].split(';').sort().join(";") === checkedLabels.sort().join(";"));
                // matchingRowsを，ヒット指数の降順にソートしてから表示する
                matchingRows.sort((row1, row2) => row2[3] - row1[3]);
                const relatedWordsForDisplay = matchingRows.map(row => `${row[1]} (${calcConfidence(row[3])})`);
                console.log(format(t("changedWordsLabel"), lemma, checkedLabelsStr));
                let displayRelated = format(t("changedWordsLabel"), lemma, checkedLabelsStr);
                if (relatedWordsForDisplay.length == 0) {
                    displayRelated += t("noMatchingChangeError");
                }
                document.getElementById('changedRelatedWords').innerText = displayRelated + relatedWordsForDisplay.join('\n');
            } catch (error) {
                console.log(error);
                document.getElementById('changedRelatedWords').innerText = t("error");
            }
        });
    });
};
