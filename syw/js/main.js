// 奇妙的事情发生了 o‿≖✧
var atkBase,atk,critRate,critDmg;
var exp=new Array(),healthy=new Array();
var maxE=0;
var A=0.04975,
	B=0.033,
	C=0.066,
	D=16.75,
	E=19.75;
 var yellow='#F3FFAC',
 	red='#FFBFAC',
 	green='#ACFFDA';
function onKeyUp(event){
	atkBase=getValue('atkBase');
	atk=getValue('atk');
	critRate=getValue('critRate')/100;
	critDmg=getValue('critDmg')/100;
	elemMastery=getValue('elemMastery');
	check();
	calc();
	print();
}
function getValue(name){
	var elem=document.forms[0][name];
	wd=elem.value;
	var n=parseFloat(wd);
	if(isNaN(n)){
		elem.value=0;
		return 0;
	}
	return n;
}
function calc(){
	//this part refer to...
	//hitExp = atk*(1+critRate*critDmg);
	//atk    = atkBase*(1+atkRate)
	//E(atk)=E(critRate)=E(critDMG)
	//critRate*atk*C/atkBase/A=1+2*critRate*critRate
	//a=2, b=atk*C/atkBase/A, c=1
	tEM=1+2.78*elemMastery/(elemMastery+1400);
	exp['score']=atk*(1+critRate*critDmg)*tEM;
	exp['atk']=atkBase*(1+critRate*critDmg)*A*tEM;
	exp['atkSmall']=(1+critRate*critDmg)*D*tEM;
	exp['critRate']=atk*critDmg*B*tEM;
	exp['critDmg']=atk*critRate*C*tEM;
	exp['elemMastery']=atk*(1+critRate*critDmg)*1400*2.78*E/(elemMastery+1400)/(elemMastery+1400);
	getMax();

	var a=2,b=-atk*C/(atkBase*A),c=1;
	healthy['critRate']=100*(-b+Math.sqrt(b*b-4*a*c))/2/a;
	if(healthy['critRate']>100){
		healthy['critRate']=100;
		healthy['critDmg']=100*atk*C/A/atkBase-100;
	}else{
		healthy['critDmg']=C/B*healthy['critRate']
	}

	healthy['critRate1']=100*(-b-Math.sqrt(b*b-4*a*c))/2/a;
	if(healthy['critRate1']>100){
		healthy['critRate1']=100;
		healthy['critDmg1']=100*atk*C/A/atkBase-100;
	}else{
		healthy['critDmg1']=C/B*healthy['critRate1']
	}
}
function print(){
	ex.innerHTML=h("偏导数(副词条参数) Partial Derivative：");
	ex.innerHTML+=p("攻击力(大攻击) ATK: ")+pNum(exp['atk'].toFixed(1),green);
	ex.innerHTML+=p("暴击率 CRIT.Rate: ")+pNum(exp['critRate'].toFixed(1),green);
	ex.innerHTML+=p("暴击伤害 CRIT.DMG: ")+pNum(exp['critDmg'].toFixed(1),green);
	ex.innerHTML+=p("元素精通(不包含<strong>反应覆盖率</strong>和<strong>反应倍率</strong>) Elemental Mastery: ")+pNum(exp['elemMastery'].toFixed(1),green);
	ex.innerHTML+=p("攻击力(小攻击) ATK: ")+pNum(exp['atkSmall'].toFixed(1),green);
	

	hel1.innerHTML=h("健康范围(如果是NaN%，则不存在健康范围)：")
	hel1.innerHTML+=p("暴击率 CRIT.Rate: ")
		+pCom(healthy['critRate1'].toFixed(1)+"%-"+healthy['critRate'].toFixed(1)+"%",);
	hel1.innerHTML+=p("暴击伤害 CRIT.DMG: ")
		+pCom(healthy['critDmg1'].toFixed(1)+"%-"+healthy['critDmg'].toFixed(1)+"%",);

	sc.innerHTML=h("综合分数 Score：");
	sc.innerHTML+=pCom(exp['score'].toFixed(1));
}
function p(text){
	return '<p>'+text+'</p>';
}
function pCom(text,color='#f9f9f9'){
	return '<div class="bg"><p class="num" style="background:'+color+'">'
		+text+'</p></div>';
}
function pNum(num,color='#f9f9f9'){
	return '<div class="bg"><p class="num" style="width:'+(100*num/maxE)+'%;background:'+color+'">'
		+num+'</p></div>';
}
function h(text){
	return '<h1>'+text+'</h1>';
}
function check() {
	if(atk<atkBase){
		atk=atkBase;
		document.forms[0]['atk'].value=atkBase;
	}
	if(critRate<0.05){
		critRate=0.05;
		document.forms[0]['critRate'].value=5.0;
	}
	if(critRate>1){
		critRate=1;
		document.forms[0]['critRate'].value=100.0;
	}
	if(critDmg<0.5){
		critDmg=0.5;
		document.forms[0]['critDmg'].value=50.0;
	}
}
function getMax(){
	maxE=exp['atk'];
	var i;
	for(i in exp){
		if(exp[i]>maxE && i!='score'){
			maxE=exp[i];
		}
	}
}



//以下内容补全
	//console.log(atkBase);
	// if(wd==""){
	// 	location.reload();//摁下回车刷新吧≖‿≖✧
	// 	scrollTo(0,0);
	// }
	// else if(dic[wd]){
	// 	wdName.innerHTML=wd;
	// 	wdExplain.innerHTML=dic[wd];
	// 	research();
	// }
	// else{
	// 	wdName.innerHTML=wd;
	// 	if(wd=="lyn"||wd=="sth"){
	// 		wdExplain.innerHTML="有话好好说!!!";
	// 		speaker.text="Hey guys";
	// 		window.speechSynthesis.speak(speaker);
	// 	}
	// 	else if(wd=="正则表达式"){
	// 		rex();
	// 	}
	// 	else{
	// 		translation.style.display="none";
	// 	} 
	// 	research();
	// }
// var list=["none"],n=1;
// var timer,intCircle;
// function research(){
// 	resultUl.innerHTML="";
// 	list=[];n=0;
// 	for(var key in dic){//包含关系搜索
// 		if(key.search(wd)!=-1 && wd!=key){
// 			if(n==0){
// 				list.push(
// 					'<button class="jump jpTitle" id="D'+(n++)+'">'+
// 						"Ⅰ.包含关系"+
// 					"</button>"
// 					);
// 			}
// 			list.push(
// 				'<button class="jump" onclick="wdJump(\''+key+'\');" id="D'+(n++)+'">'+
// 					key +
// 					'<span class="jpExplain">'+
// 						dic[key] +
// 					'</span>'+
// 				"</button>"
// 				);
// 		}
// 	}

// 	var beginning="^",alphaN=0,n0=n;
// 	if(wd.length>=4 && wd[0]!="^"){//前缀搜索
// 		for(var i=0;i<4;i++){
// 			if("aeiou".includes(wd[i])){
// 				alphaN++;
// 			}
// 			beginning+=wd[i];
// 			if(alphaN==2){
// 				break;
// 			}
// 		}
// 		// alert(beginning);
// 		for(var key in dic){
// 			if(key.search(beginning)!=-1 && wd!=key){
// 				if(n==n0){
// 					list.push(
// 						'<button class="jump jpTitle" id="D'+(n++)+'">'+
// 							"Ⅱ.相同前缀("+beginning+")"+
// 						"</button>"
// 						);
// 				}
// 				list.push(
// 					'<button class="jump" onclick="wdJump(\''+key+'\');" id="D'+(n++)+'">'+
// 						key +
// 						'<span class="jpExplain">'+
// 							dic[key] +
// 						'</span>'+
// 					"</button>"
// 					);
// 			}
// 		}
// 	}

// 	var endding="$",n1=n;alphaN=0;
// 	if(wd.length>=4 && wd[wd.length-1]!="$"){//后缀搜索
// 		for(var i=(wd.length-1);i>=(wd.length-4);i--){
// 			if("aeiou".includes(wd[i])){
// 				alphaN++;
// 			}
// 			endding=wd[i]+endding;
// 			if(alphaN==2){
// 				break;
// 			}
// 		}
// 		// alert(endding);
// 		for(var key in dic){
// 			if(key.search(endding)!=-1 && wd!=key){
// 				if(n==n1){
// 					list.push(
// 						'<button class="jump jpTitle" id="D'+(n++)+'">'+
// 							"Ⅲ.相同后缀("+endding+")"+
// 						"</button>"
// 						);
// 				}
// 				list.push(
// 					'<button class="jump" onclick="wdJump(\''+key+'\');" id="D'+(n++)+'">'+
// 						key +
// 						'<span class="jpExplain">'+
// 							dic[key] +
// 						'</span>'+
// 					"</button>"
// 					);
// 			}
// 		}
// 	}
// 	if(n==0){
// 		list.push(
// 			'<button class="jump jpTitle jpEpt" id="D'+(n++)+'">'+
// 				"什么都没有了::>_<::"+
// 			"</button>"
// 		);
// 	}
// 	n=0;
// 	clearInterval(timer);
// 	intCircle=150;
// 	timer=setInterval(frame,intCircle);
// }
// function frame(){
// 	if(n<list.length){
// 		resultUl.innerHTML+=list[n++];
// 		if(n!=1){
// 			document.querySelector("#Dm").id="Done";
// 		}
// 		document.querySelector("#D"+(n-1)).id="Dm";
// 		// scrollTo(0,20030821);
// 		if(n>=17){//我十七岁那年认识了她(。・・)ノ
// 			intCircle=1;
// 			clearInterval(timer);
// 			timer=setInterval(frame,intCircle);
// 		}
// 		if(n>=150){
// 			intCircle=400;
// 			clearInterval(timer);
// 			timer=setInterval(frame,intCircle);
// 		}
// 		if(n>=200){
// 			intCircle=1;
// 			clearInterval(timer);
// 			timer=setInterval(frame,intCircle);
// 		}
// 	}
// 	else{
// 		clearInterval(timer);
// 	}
// }
// function wdJump(twd){// 联想记忆法，实用又高效(..•˘_˘•..)
// 	wd=twd;
// 	translation.style.display="";
// 	wdName.innerHTML=wd;
// 	wdExplain.innerHTML=dic[wd];
// 	scrollTo(0,0);
// 	research();
// }
// function speak(){// 你想听单词，那我就大声读给你听(*•̀ㅂ•́)و
// 	speaker.text=wdName.innerHTML;
// 	window.speechSynthesis.speak(speaker);
// }
// function onKeyPress(e) {//开车啦...不是...回车啦((٩(//̀Д/́/)۶))
// 	var keyCode=null;
// 	if(e.which)
// 		keyCode=e.which;
// 	else if(e.keyCode)
// 		keyCode=e.keyCode;
// 	if(keyCode == 13) {
// 		search();
// 		return false;
// 	}
// 	return true;
// }
// function rex() {//要不要了解一下正则表达式呐ฅ(๑*д*๑)ฅ
// 	wdName.innerHTML="正则表达式";
// 	wdExplain.innerHTML='正则表达式是对字符串操作的一种逻辑公式，就是用事先定义好的一些特定字符、及这些特定字符的组合，组成一个“规则字符串”，这个“规则字符串”用来表达对字符串的一种过滤逻辑。<br><br>下面将介绍简单的用法：<br>Ⅰ. “.”可以代替一个字母，也可以用“[a-z]”<br>Ⅱ. “.*”可以代替多个字母<br>Ⅲ. “$”用于判断后缀，如“tion$”<br>Ⅳ. “^”用于判断前缀，如“^ab”<br>Ⅴ. “?”用于可有可无的字符，如“colou?r”<br>Ⅵ. “|”可用于同时搜索<br><br><a onclick="example();">e.g. 以“acc”开头，以“tion”或“ing”结尾可以搜索“^acc.*(tion|ing)$”</a>';
// }
// function example(){
// 	document.querySelector('#searchDiv input[name="word"]').value="^acc.*(tion|ing)$";
// 	search();
// }
console.log("\n\n\n\n\n        萌是深藏不漏的✿◡‿◡\n\n\n\n\n\n");