var timer,wd="",guess="~";
const speaker = new window.SpeechSynthesisUtterance();
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
	elem.value="";
	if(wd==""){
		alert("empty");
	}
	else if(dic[wd]){
		wdName.innerHTML=wd;
		wdExplain.innerHTML=dic[wd];
		research();
	}
	else{
		wdName.innerHTML=wd;
		if(wd=="lyn"||wd=="sth"){
			wdExplain.innerHTML="╮(๑•́ ₃•̀๑)╭有话好好说";
			speak("Hi guys");
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
		// resultUl.innerHTML+='<br>';
		for(var key in dic){
			if(wd!=key)
			if(wd.search(key)!=-1){
				resultUl.innerHTML+='<button class="jump" onclick="wdJump(\''+key+'\');">'+key+"</button>";
			}
		}
	}
}
function wdJump(twd){
	wd=twd;
	wdName.innerHTML=wd;
	wdExplain.innerHTML=dic[wd];
	research();
}
function checkIn(){
	search();
	clearInput();
}
function speak(){
	speaker.text=wdName.innerHTML;
	window.speechSynthesis.speak(speaker);
}
