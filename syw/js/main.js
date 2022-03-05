// 奇妙的事情发生了 o‿≖✧
var atkBase,atkAdd,critRate,critDmg;
var exp=new Array(),expEM=new Array(),healthy=new Array(),expBase;
var maxA=0,maxB=0;
var A=0.04975,
	B=0.033,
	C=0.066,
	D=16.75,//小公鸡
	E=19.75;//精通
var RATIO=1.25;
var yellow='#ffa',
 	red='#fba',
 	orange='#fec',
 	green='#afd';
function onKeyUp(event){
	atkBase=getValue('atkBase');
	atkAdd=getValue('atkAdd');
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
	expBase       =getExp(atkBase+atkAdd,critRate,critDmg,elemMastery);
	expBaChong1   =getExpBaChong1(atkBase+atkAdd,critRate,critDmg,elemMastery)

	expOverloaded =getExpOverloaded(atkBase+atkAdd,critRate,critDmg,elemMastery);
	expBaChong    =getExpBaChong(atkBase+atkAdd,critRate,critDmg,elemMastery);

	exp['atk']      =getExp(atkBase*(1+A)+atkAdd,critRate,critDmg,elemMastery)-expBase;
	exp['atkSmall'] =getExp(atkBase+atkAdd+D,critRate,critDmg,elemMastery)-expBase;
	exp['elemMastery'] =getExp(atkBase+atkAdd,critRate,critDmg,elemMastery+E)-expBase;
	exp['BaChong'] =getExp(atkBase+atkAdd,critRate,critDmg,elemMastery+E)-expBase;
	exp['critRate'] =getExp(atkBase+atkAdd,(critRate+B)>=1?1:(critRate+B),critDmg,elemMastery)-expBase;
	exp['critDmg']  =getExp(atkBase+atkAdd,critRate,critDmg+C,elemMastery)-expBase;
	exp['BaChong']  =getExpBaChong1(atkBase+atkAdd,critRate,critDmg,elemMastery+E)-expBaChong1;
	getMaxA();

	
	expEM['Overloaded']  =(getExpOverloaded(atkBase+atkAdd,critRate,critDmg,elemMastery+E)-expOverloaded);
	expEM['BaChong']     =(getExpBaChong(atkBase+atkAdd,critRate,critDmg,elemMastery+E)-expBaChong);
	getMaxB()

	var a=2,b=-(atkBase+atkAdd)*C/(atkBase*A),c=1;
	healthy['critRate']=100*(-b+Math.sqrt(b*b-4*a*c))/2/a;
	if(healthy['critRate']>100){
		healthy['critRate']=100;
		healthy['critDmg']=100*(atkBase+atkAdd)*C/A/atkBase-100;
	}else{
		healthy['critDmg']=C/B*healthy['critRate']
	}

	healthy['critRate1']=100*(-b-Math.sqrt(b*b-4*a*c))/2/a;
	if(healthy['critRate1']>100){
		healthy['critRate1']=100;
		healthy['critDmg1']=100*(atkBase+atkAdd)*C/A/atkBase-100;
	}else{
		healthy['critDmg1']=C/B*healthy['critRate1']
	}
}
function check() {
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
function getMaxA(){
	maxA=exp['atk'];
	var i;
	for(i in exp){
		if(exp[i]>maxA && i!='score'){
			maxA=exp[i];
		}
	}
}
function getMaxB(){
	maxB=expEM['BaChong'];
	var i;
	for(i in expEM){
		if(expEM[i]>maxB && i!='score'){
			maxB=expEM[i];
		}
	}
}
/****元素精通****/
function getEMRate(elemMastery){
	return 25*elemMastery/(elemMastery+1400)/9;
}
function getOverloaded(elemMastery){
	return 723.29*4*(1+16*elemMastery/(elemMastery+2000))/3;
}
/****伤害****/
function getExp(atk,critRate,critDmg,elemMastery){
	return atk*(1+critRate*critDmg)*(1+getEMRate(elemMastery));
}
function getExpOverloaded(atk,critRate,critDmg,elemMastery){
	return atk*(1+critRate*critDmg)+getOverloaded(elemMastery)/RATIO;
}
/****八重神子****/
function getExpBaChong(atk,critRate,critDmg,elemMastery){
	return atk*(1+critRate*critDmg)*(1+0.0015*elemMastery)+getOverloaded(elemMastery)/1.706;
}
function getExpBaChong1(atk,critRate,critDmg,elemMastery){
	return atk*(1+critRate*critDmg)*(1+0.0015*elemMastery);
}
/****输出****/
function print(){
	sc.innerHTML=h("综合分数 Score：");
	sc.innerHTML+=div(expBase.toFixed(1))+"<br>";

	ex.innerHTML=h("偏导数(副词条参数) Partial Derivative：");
	colum("攻击力(大攻击) ATK: ",exp['atk'],green,maxA);
	colum("攻击力(小攻击) ATK: ",exp['atkSmall'],green,maxA);
	colum("元素精通(增幅) 融化2.0 蒸发1.5 Elemental Mastery: ",exp['elemMastery'],green,maxA);
	colum("暴击率 CRIT.Rate: ",exp['critRate'],green,maxA);
	colum("暴击伤害 CRIT.DMG: ",exp['critDmg'],green,maxA);
	colum("元素精通(八重神子) 天赋 Elemental Mastery: ",exp['BaChong'],green,maxA);
	ex.innerHTML+="<br>";

	ex.innerHTML+=h("元素精通(单次剧变 90级 附着周期2.5s 高攻速加倍"+(RATIO*100)+"%技能倍率) Elemental Mastery: ");
	colum("扩散 元素最多扩散两次 可能触发其他剧变",expEM['Overloaded']*0.3,orange,maxB);
	colum("超载 火伤 爆炸",expEM['Overloaded'],orange,maxB);
	colum("感电 共存 连续反应",expEM['Overloaded']*0.6,orange,maxB);
	colum("超导 冰伤 降低物理抗性",expEM['Overloaded']*0.25,orange,maxB);
	colum("冻结 碎冰",expEM['Overloaded']*0.75,orange,maxB);

	colum("八重神子(170.6%技能倍率)：超载 火伤 爆炸",expEM['BaChong'],orange,maxB);
	colum("八重神子(170.6%技能倍率)：感电 共存 连续反应",expEM['BaChong']*0.6,orange,maxB);
	ex.innerHTML+="<br>";

	hel1.innerHTML=h("健康范围(如果是NaN%，则不存在健康范围)：");
	hel1.innerHTML+=p("暴击率 CRIT.Rate: ")
		+div(healthy['critRate1'].toFixed(1)+"%-"+healthy['critRate'].toFixed(1)+"%");
	hel1.innerHTML+=p("暴击伤害 CRIT.DMG: ")
		+div(healthy['critDmg1'].toFixed(1)+"%-"+healthy['critDmg'].toFixed(1)+"%");

	
}
function colum(text,num,color,max){
	ex.innerHTML+=p(text)+colorDiv(num,color,max);
}
function bar(text,num){
	ex.innerHTML+=p(text)+div(num);
}
function p(text){
	return '<p>'+text+'</p>';
}
function div(text,color='#f9f9f9'){
	return '<div class="bg"><p class="num" style="'+
	'background:'+color+';'
	+'">'+text+'</p></div>';
}
function colorDiv(num,color='#f9f9f9',max){
	return '<div class="bg"><p class="num" style="'+
		'width:'+((100*num/max)>=100?100:(100*num/max))+'%;'+
		'background:'+color+';'+
		'">'+num.toFixed(1)+'</p></div>';
}
function h(text){
	return '<h1>'+text+'</h1>';
}


console.log("\n\n\n\n\n        萌是深藏不漏的✿◡‿◡\n\n\n\n\n\ntip:修改ratio来修改技能倍率");