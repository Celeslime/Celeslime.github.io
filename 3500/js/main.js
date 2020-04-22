// 奇妙的事情发生了 o‿≖✧
var timer,wd="",guess="~";
const speaker=new window.SpeechSynthesisUtterance();
speaker.rate="0.5";
speaker.lang="en";
function save(){
	var key=document.querySelector('#saveDiv input[name="key"]').value;
	var val=document.querySelector('#saveDiv input[name="value"]').value;
	dic[key]=val;
	saveTip.innerHTML="DONE";
}
function search(){
	var elem=document.querySelector('#searchDiv input[name="word"]');
	wd=elem.value;
	// elem.value="";//想了想还是不要这样了
	if(wd==""){
		location.reload();//摁下回车刷新吧≖‿≖✧
	}
	else if(dic[wd]){
		wdName.innerHTML=wd;
		wdExplain.innerHTML=dic[wd];
		research();
	}
	else{
		wdName.innerHTML=wd;
		if(wd=="lyn"||wd=="sth"){
			wdExplain.innerHTML="╮(๑•́ ₃•̀๑)╭朋友，有话好好说";
			speaker.text="Hey guys";
			window.speechSynthesis.speak(speaker);
		}
		else if(wd=="正则表达式"){
			rex();
		}
		else{
			wdExplain.innerHTML="(๑•́ ₃ •̀),,哪有这单词，是不是下面这一些？";
		} 
		research();
	}
}
function research(){
	resultUl.innerHTML="";
	if(wd.length>1){
		for(var key in dic){
			if(wd!=key)
			if(key.search(wd)!=-1){
				resultUl.innerHTML+='<button class="jump" onclick="wdJump(\''+key+'\');">'+key+"</button>";
			}
		}
		for(var key in dic){
			if(wd!=key)
			if(wd.search(key)!=-1){
				resultUl.innerHTML+='<button class="jump" onclick="wdJump(\''+key+'\');">'+key+"</button>";
			}
		}
	}
}
function wdJump(twd){// 联想记忆法，实用又高效(..•˘_˘•..)
	wd=twd;
	wdName.innerHTML=wd;
	wdExplain.innerHTML=dic[wd];
	research();
}
function speak(){// 你想听单词，那我就大声读给你听(*•̀ㅂ•́)و
	speaker.text=wdName.innerHTML;
	window.speechSynthesis.speak(speaker);
}
function onKeyPress(e) {//开车啦...不是...回车啦((٩(//̀Д/́/)۶))
	var keyCode=null;
	if(e.which)
		keyCode=e.which;
	else if(e.keyCode)
		keyCode=e.keyCode;
	if(keyCode == 13) {
		search();
		return false;
	}
	return true;
}
function rex() {//要不要了解一下正则表达式呐ฅ(๑*д*๑)ฅ
	wdName.innerHTML="正则表达式";
	wdExplain.innerHTML='正则表达式是对字符串操作的一种逻辑公式，就是用事先定义好的一些特定字符、及这些特定字符的组合，组成一个“规则字符串”，这个“规则字符串”用来表达对字符串的一种过滤逻辑。<br><br>下面将介绍简单的用法：<br>a. “.”可以代替一个字母，也可以用“[a-z]”<br>b. “.*”可以代替多个字母<br>c. “$”用于判断后缀，如“tion$”<br>d. “^”用于判断前缀，如“^ab”<br>e. “?”用于可有可无的字符，如“colou?r”<br>f. “|”可用于同时搜索<br><br><a onclick="example();">e.g. 以“acc”开头，以“tion”或“ing”结尾可以搜索“^acc.*(tion|ing)$”</a>';
}
function example(){
	document.querySelector('#searchDiv input[name="word"]').value="^acc.*(tion|ing)$";
	search();
}
//萌是深藏不漏的✿◡‿◡