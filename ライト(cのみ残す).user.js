// ==UserScript==
// @name		ライトでcだけ残す
// @namespace	https://gist.github.com/RAPT21/
// @description	ブラウザ三国志 ブショーダス補助 by RAPT kobe編集
// @include		https://*.3gokushi.jp/busyodas/busyodas_continuty_result.php*
// @include		http://*.3gokushi.jp/busyodas/busyodas_continuty_result.php*
// @require		https://ajax.googleapis.com/ajax/libs/jquery/3.2.1/jquery.min.js
// @connect		3gokushi.jp
// @grant		none
// @author		RAPT/kobe
// @version 	0.5
// ==/UserScript==
jQuery.noConflict();
q$ = jQuery;

// ブショーダスライト等の画面でスキル名にマッチしないカードに削除チェックを入れる＆自動で引くツール。
// スキル名は前方一致。
// デフォルトでロックされているR以上のカードや特殊カードは変更しない。
// 該当スキルをカスタムしたい場合、スクリプト内カスタム設定で変更可能。


// 2020.11.11  0.1	初版。ブショーダスライトのみ対応
// 2021.01.09  0.2	小麗もサポート。スキル名を部分一致から前方一致へ変更
// 2022.03.24  0.3	自動ダス（自動でブショーダスを引く）機能を追加
//					自動ダスを無効にしたい場合、スクリプト内カスタム設定で変更可能
//					「あなたが持てる武将カード」が残り0枚になるか、現在のBP/チケットが規定に満たない場合は停止
// 2022.06.21  0.4	カードNoで残すカードを指定できるように。残すカードNoになく、スキル名もマッチしないカードを削除対象にします。

var VERSION = "2022.06.21.dev";

//=====[ カスタム設定 ]=====
// 自動ダスを有効にするか
var isSupportAutoDas = true;

// 自動ダスのウェイト（ミリ秒）
// サーバー負荷対策のため1000（1秒）以上を推奨
var waitInterval = 1500;

// 残すカードNo
var wantCardNos = [
1013,
1018,
1020,
1024,
1026,
1028,
1030,
1032,
1034,
1040,
1058,
1059,
2011,
2015,
2018,
2021,
2023,
2025,
2028,
2030,
2032,
2034,
2036,
2038,
2046,
2056,
3012,
3016,
3018,
3020,
3022,
3024,
3026,
3028,
3030,
3039,
3187,
4007,
4009,
4011,
4013,
4015,
4017,
4019,
4021,
4023,



];

// 前方一致
var wantSkillNames = [
	"千里雷光",
    "万里雷光",
//以下、練兵修練素材,
];

//=====[ 内部用 ]=====
// 自動ダスを継続するか
var canContinueAutoDas = true;


// スキル名をチェックして残すカードはtrueを返す
function isWantSkill(skillName) {
	var result = false;
	q$.each(wantSkillNames, function(index, name){
		var re = new RegExp(`${name}.*`);
		if (re.test(skillName)) {
			result = true;
			return false;
		}
	});
	return result;
}

// カード情報をチェックして残すカードはtrueを返す
function isWantCard(cols) {
	var info = q$('div.omote_4sk', cols.eq(1));

	// カードNoで探す
	var cardno = parseInt(q$('span.cardno', info).text().trim(), 10);
	var isWant = wantCardNos.length > 0 && wantCardNos.indexOf(cardno) >= 0;
	if (isWant) {
		return true;
	}

	// コストで探す: TBD
	//var cost = parseFloat(q$('span[class="cost-for-sub"]', info).text().trim());

	// スキル名で探す
	var skillName = cols.eq(2).text().trim();
	return isWantSkill(skillName);
}

// 不要カードのセルにチェックを入れる
var proc = function(){
	var cols = q$("td", this);
	if (cols.length === 4) {
		if (!isWantCard(cols)) {
			q$("input.delete", cols.eq(0)).prop('checked', true);
		}
	}
};

// 指定ミリ秒のウェイトを入れる
function wait(msec) {
	var d = new q$.Deferred;
	setTimeout(function() {
		d.resolve();
	}, msec);
	return d.promise();
}

// 処理を注入
function inject(id, checkRepeat) {
	if (isSupportAutoDas) {
		// 自動ダスを停止できるように
		q$('<button>', { id: 'stopNextTicket', text: '自動ダスを停止' }).insertAfter(`#${id}`);
		q$('#stopNextTicket').on('click', function(){
			canContinueAutoDas = false;
			q$(this).text('自動ダスを停止しました');
		});
	}

	// 不要カードへチェックを入れる
	q$(`#${id} .commonTables tr`).each(proc);

	if (!isSupportAutoDas) {
		// 自動ダス無効ならここで処理終了
		return;
	}

	// 以下、自動ダス機能

	// 残存チケット確認
	var mes = q$('div[class="sysMes2"]').text().trim().replace(/\s+/g, ' ');
	var ticket = parseInt(mes.replace(/.*?現在の.+?:(\d+).*/, "$1"), 10);

	// ファイルの空きを確認
	var vacant = parseInt(mes.replace(/.*?残り(\d+)枚.*/, "$1"), 10);

	// 「もういちど引く」の実行判定
	var check1 = checkRepeat && checkRepeat(ticket); // checkRepeat が指定されていればそちらで判定
	var check2 = !checkRepeat && ticket > 0; // checkRepeat 省略時は残存チケットが1以上なら継続
	var isContinue = vacant > 0 && (check1 || check2);

	if (isContinue) {
		// 指定時間経過後に「もういちど引く」を実行
		wait(waitInterval).done(function() {
			if (canContinueAutoDas) {
				console.log("「もういちど引く」を実行");
				q$(`#${id}`).attr('action', 'busyodas.php').submit();
			} else {
				console.log("「もういちど引く」は停止");
			}
		});
	}
}

// ブショーダスライト
inject('busyodasDraw_18110500000', function(bp) {
	return bp >= 100000000000;
});
