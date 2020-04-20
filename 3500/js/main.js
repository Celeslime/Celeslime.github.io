var timer,wd="",guess="~";
function save(){
	var key=document.querySelector('#saveDiv input[name="key"]').value;
	var val=document.querySelector('#saveDiv input[name="value"]').value;
	dic[key]=val;
	saveTip.innerHTML="DONE";
}
function search(){
	resultUl.innerHTML="";
	var elem=document.querySelector('#searchDiv input[name="word"]');
	wd=elem.value;
	elem.value="输入搜索单词";
	elem.style.color="#aaa";

	if(wd==""){
		alert("empty");
	}
	else if(dic[wd]){
		wdName.innerHTML=wd;
		wdExplain.innerHTML=dic[wd];
		research();
	}
	else{
		wdName.innerHTML="\""+wd+"\""+"<br>NOT FIND";
		wdExplain.innerHTML="";
		research();
	}
}
function research(){
	if(wd.length>1)
	for(var key in dic){
		if(wd!=key && key.length>1)
		if(wd.search(key)!=-1){
			resultUl.innerHTML+='<button onclick="wdJump(\''+key+'\');">'+key+"</button>";
		}
		else if(key.search(wd)!=-1){
			resultUl.innerHTML+='<button onclick="wdJump(\''+key+'\');">'+key+"</button>";
		}
	}
}
function wdJump(twd){
	wd=twd;
	resultUl.innerHTML="";
	wdName.innerHTML=wd;
	wdExplain.innerHTML=dic[wd];
	research();
}
function clearInput(){
	var elem=document.querySelector('#searchDiv input[name="word"]');
	elem.value="";
	elem.style.color="#000";
	elem.style.font="normal";
}
function checkIn(){
	// console.log("innerHTML");
	search();
	clearInput();
}