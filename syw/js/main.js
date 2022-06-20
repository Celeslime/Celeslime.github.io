// 奇妙的事情发生了 o‿≖✧
var atkBase,atkAdd,critRate,critDmg;
var exp=new Array(),expEM=new Array(),healthy=new Array(),expBase;
var maxA=0,maxB=0;
var A=0.0495,
	B=0.033,
	C=0.066,
	D=16.5,//小公鸡
	E=19.835 ;//精通
var FixNum=1;
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
class ATK{
	constructor(base=0,add=0){
		this.Base=base;
		this.Add=add;
	}
	getATK(rate){
		return Base*(1+rate)+Add;
	}
}
class CRIT{
	constructor(rate=0,dmg=0){
		this.Rate=rate;
		this.DMG=dmg;
	}
}
class Vector{
	constructor(atk=ATK(),crit=CRIT(),elemMastery=0){
		this.ATK=atk;
		this.CRIT=critRate;
		this.ElemMastery=elemMastery;
	}
	getExp(){
		return ATK.getATK();
	}
}

function calc(){
	expBase         =getExp(atkBase+atkAdd,critRate,critDmg,elemMastery);
	expBaChong1     =getExpBaChong1(atkBase+atkAdd,critRate,critDmg,elemMastery)
	expOverloaded   =getExpOverloaded(atkBase+atkAdd,critRate,critDmg,elemMastery);
	expBaChong      =getExpBaChong(atkBase+atkAdd,critRate,critDmg,elemMastery);

	exp['atk']      =getExp(atkBase*(1+A)+atkAdd,critRate,critDmg,elemMastery)-expBase;
	exp['atkSmall'] =getExp(atkBase+atkAdd+D,critRate,critDmg,elemMastery)-expBase;
	exp['elemMastery']=getExp(atkBase+atkAdd,critRate,critDmg,elemMastery+E)-expBase;
	exp['critRate'] =getExp(atkBase+atkAdd,(critRate+B)>=1?1:(critRate+B),critDmg,elemMastery)-expBase;
	exp['critDmg']  =getExp(atkBase+atkAdd,critRate,critDmg+C,elemMastery)-expBase;
	exp['BaChong']  =getExpBaChong1(atkBase+atkAdd,critRate,critDmg,elemMastery+E)-expBaChong1;
	getMaxA();

	
	expEM['Overloaded']=getExpOverloaded(atkBase+atkAdd,critRate,critDmg,elemMastery+E)-expOverloaded;
	expEM['BaChong']   =getExpBaChong(atkBase+atkAdd,critRate,critDmg,elemMastery+E)-expBaChong;
	getMaxB()

	var scouce=(atkAdd/atkBase)/A+critRate/B+critDmg/C,s1=scouce+1/3;
	var expAllATK=getExp(1+A*(scouce-0.05/B-0.50/C),0.05,0.50,0);
	var hRate=(s1+Math.sqrt(s1*s1-1.5))/6,hATK=1/8/hRate+hRate-1/3;
	var expBest=getExp(1+A*hATK,B*hRate,C*hRate,0);
	if(expBest>expAllATK){
		healthy['atkAdd']=atkBase*A*hATK;
		healthy['critRate']=B*hRate;
		healthy['critDmg']=C*hRate;
	}
	else{
		healthy['atkAdd']=atkBase*A*(scouce-0.05/B-0.50/C)
		healthy['critRate']=0.05;
		healthy['critDmg']=0.50;
	}


	var a=2,b=-(atkBase+atkAdd)*C/(atkBase*A),c=1;
	healthy['critRate0']=100*(-b+Math.sqrt(b*b-4*a*c))/2/a;
	if(healthy['critRate0']>100){
		healthy['critRate0']=100;
		healthy['critDmg0']=100*(atkBase+atkAdd)*C/A/atkBase-100;
	}else{
		healthy['critDmg0']=C/B*healthy['critRate0']
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
function getExp(atk,cR,cD,eM){
	return atk*(1+cR*cD)*(1+getEMRate(eM));
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
/****操作函数****/
function fatk(i=1){
	var elem=document.forms[0]['atkAdd'];
	elem.value=(getValue('atkAdd')+getValue('atkBase')*A*i).toFixed(FixNum);
	onKeyUp();
}
function fcritRate(i=1){
	var elem=document.forms[0]['critRate'];
	elem.value=(getValue('critRate')+B*i*100).toFixed(FixNum);
	onKeyUp();
}
function fcritDmg(i=1){
	var elem=document.forms[0]['critDmg'];
	elem.value=(getValue('critDmg')+C*i*100).toFixed(FixNum);
	onKeyUp();
}
function felemMastery(i=1){
	var elem=document.forms[0]['elemMastery'];
	elem.value=(getValue('elemMastery')+E*i).toFixed(FixNum);
	onKeyUp();
}
/****输出****/
function print(){
	sc.innerHTML=p('攻击力 ATK:')+div(atkBase+atkAdd)+'<br>';

	sc.innerHTML+=h("综合分数 Score:");
	sc.innerHTML+=div(expBase.toFixed(FixNum))+"<br>";

	sc.innerHTML+=h("修正数据 Fixed:");
	sc.innerHTML+=p('攻击力增加 ATK.addition:')+div(healthy['atkAdd'].toFixed(0));
	sc.innerHTML+=p('攻击力 ATK:')+div((atkBase+healthy['atkAdd']).toFixed(0));
	sc.innerHTML+=p('暴击率 CRIT.Rate:')+div((100*healthy['critRate']).toFixed(0));
	sc.innerHTML+=p('暴击伤害 CRIT.Dmg:')+div((100*healthy['critDmg']).toFixed(0));
	var scFix=getExp(atkBase+healthy['atkAdd'],healthy['critRate'],healthy['critDmg'],elemMastery);
	sc.innerHTML+=p('修正分数 CRIT.Dmg:')+div(scFix.toFixed(FixNum)+' (+'+(100*(scFix/expBase-1)).toFixed(FixNum)+'%)')+'<br>';

	ex.innerHTML=h("偏导数(副词条参数) Partial Derivative：");
	colum("攻击力(大攻击) ATK: ",exp['atk'],green,maxA);
	colum("攻击力(小攻击) ATK: ",exp['atkSmall'],green,maxA);
	colum("元素精通(增幅) 融化2.0 蒸发1.5 Elemental Mastery: ",exp['elemMastery'],green,maxA);
	colum("暴击率 CRIT.Rate: ",exp['critRate'],green,maxA);
	colum("暴击伤害 CRIT.DMG: ",exp['critDmg'],green,maxA);
	// colum("元素精通(八重神子) 天赋 Elemental Mastery: ",exp['BaChong'],green,maxA);
	ex.innerHTML+="<br>";

	ex.innerHTML+=h("元素精通(单次剧变 90级 附着周期2.5s 高攻速加倍"+(RATIO*100)+"%技能倍率) Elemental Mastery: ");
	colum("扩散(+60%伤害+40%减抗后) 两段/可能触发其他剧变",expEM['Overloaded']*0.3*2*2,orange,maxB);
	colum("超载 火伤 爆炸",expEM['Overloaded'],orange,maxB);
	colum("感电 共存 连续反应",expEM['Overloaded']*0.6,orange,maxB);
	colum("超导 冰伤 降低物理抗性",expEM['Overloaded']*0.25,orange,maxB);
	colum("冻结 碎冰",expEM['Overloaded']*0.75,orange,maxB);

	// colum("八重神子(170.6%技能倍率)：超载 火伤 爆炸",expEM['BaChong'],orange,maxB);
	// colum("八重神子(170.6%技能倍率)：感电 共存 连续反应",expEM['BaChong']*0.6,orange,maxB);
	ex.innerHTML+="<br>";

	hel1.innerHTML=h("健康范围(如果是NaN%，则不存在健康范围)：");
	hel1.innerHTML+=p("暴击率 CRIT.Rate: ")
		+div(healthy['critRate1'].toFixed(FixNum)+"%-"+healthy['critRate0'].toFixed(FixNum)+"%");
	hel1.innerHTML+=p("暴击伤害 CRIT.DMG: ")
		+div(healthy['critDmg1'].toFixed(FixNum)+"%-"+healthy['critDmg0'].toFixed(FixNum)+"%");

	
}
function colum(text,num,color,max){
	ex.innerHTML+=p(text)+colorDiv(num,color,max);
}
function bar(text,num){
	ex.innerHTML+=p(text)+div(num);
}
function p(text){
	return '<p>'
		+text+'</p>';
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
		'">'+num.toFixed(FixNum)+'</p></div>';
}
function h(text){
	return '<h1>'
		+text+'</h1>';
}


console.log("\n\n\n\n\n        萌是深藏不漏的✿◡‿◡\n\n\n\n\n\ntip:修改ratio来修改技能倍率");