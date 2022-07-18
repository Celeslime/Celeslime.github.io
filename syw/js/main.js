// 奇妙的事情发生了 o‿≖✧
var atkBase,atkAdd,critRate,critDmg,elemMastery;
var exp=new Array(),expEM=new Array(),healthy=new Array(),expBase;
var maxA=0,maxB=0,RATIO=2.00;

//以下数据由副词套保留两位小数后取平均值获得
var A=0.0496, //攻击力百分比
	B=0.033,  //啧
	C=0.066,  //啧啧
	D=16.535, //攻击力
	E=19.815 ;//精通
//结果保留位数
var FixNum=1;
//搞颜色(*/ω＼*)
var yellow='#ffa',
 	red='#fba',
 	orange='#fec',
 	green='#afd';
//交互
function onKeyUp(event){
	getValues();
	check();
	calc();
	print();
}
function getValues(){
	atkBase=getValue('atkBase');
	atkAdd=getValue('atkAdd');
	critRate=getValue('critRate')/100;
	critDmg=getValue('critDmg')/100;
	elemMastery=getValue('elemMastery');
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
//算法
function calc(){
	expBase=getExp(atkBase+atkAdd,critRate,critDmg,elemMastery);
	expOverloaded=getExpOverloaded(atkBase+atkAdd,critRate,critDmg,elemMastery);
	//虽说是偏导数，但...的效果会更好
	exp['atk']=getExp(atkBase*(1+A)+atkAdd,critRate,critDmg,elemMastery)-expBase;
	exp['atkSmall']=getExp(atkBase+atkAdd+D,critRate,critDmg,elemMastery)-expBase;
	exp['elemMastery']=getExp(atkBase+atkAdd,critRate,critDmg,elemMastery+E)-expBase;
	exp['critRate']=getExp(atkBase+atkAdd,critRate+B,critDmg,elemMastery)-expBase;
	exp['critDmg']=getExp(atkBase+atkAdd,critRate,critDmg+C,elemMastery)-expBase;
	getMaxA();
	//在这里以超载为一个基准量
	expEM['Overloaded']=getExpOverloaded(atkBase+atkAdd,critRate,critDmg,elemMastery+E)-expOverloaded;
	getMaxB()
	//这里用拉格朗日约束的一个推导
	var scouce=(atkAdd/atkBase)/A+critRate/B+critDmg/C,s1=scouce+1/3;
	var expAllATK=getExp(1+A*(scouce-0.05/B-0.50/C),0.05,0.50,0);
	var hRate=(s1+Math.sqrt(s1*s1-1.5))/6,hATK=1/8/hRate+hRate-1/3;
	var expBest=getExp(1+A*hATK,B*hRate,C*hRate,0);
	//极值点特判
	if(expBest>expAllATK){
		healthy['atkAdd']=atkBase*A*hATK;
		healthy['critRate']=B*hRate;
		healthy['critDmg']=C*hRate;
		if(healthy['critRate']>1){
			scouce-=1/B;//去除暴击率
			hATK=(3*C*scouce-1)/(4*A+3*C);
			hRate=scouce-hATK;
			expBest=getExp(1+A*hATK,1,C*hRate,0);
			healthy['atkAdd']=atkBase*A*hATK;
			healthy['critRate']=1;
			healthy['critDmg']=C*hRate;
		}
	}
	else{
		healthy['atkAdd']=atkBase*A*(scouce-0.05/B-0.50/C)
		healthy['critRate']=0.05;
		healthy['critDmg']=0.50;
	}
}
function check() {
	//暴击率《通常》不低于5%
	//暴击伤害不低于50%
	if(critDmg<0.5){
		critDmg=0.5;
		document.forms[0]['critDmg'].value=50.0;
	}
	//元素精通不小于0
	if(elemMastery<0){
		elemMastery=0;
		document.forms[0]['elemMastery'].value=0;
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
	maxB=expEM['Overloaded'];
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
	if(cR>1)cR=1;
	if(cR<0)cR=0;
	return atk*(1+cR*cD)*(1+getEMRate(eM));
}
function getExpOverloaded(atk,critRate,critDmg,elemMastery){
	return atk*(1+critRate*critDmg)+getOverloaded(elemMastery)/RATIO;
}




//输出 自由排版
function print(){
	sc.innerHTML=p('攻击力 ATK:')+div(atkBase+atkAdd)+'<br>';

	sc.innerHTML+=h("综合分数 Score:");
	sc.innerHTML+=div(expBase.toFixed(FixNum))+"<br>";

	var scFix=getExp(atkBase+healthy['atkAdd'],healthy['critRate'],healthy['critDmg'],elemMastery);
	var fixVal=scFix-expBase,fixColor=green;
	if(maxA<fixVal){
		fixColor=red;
		maxA*=1.2
	}
	sc.innerHTML+=h("修正数据 Fixed:");
	sc.innerHTML+=p('攻击力 ATK:')+div(atkBase+' + '+healthy['atkAdd'].toFixed(0)+' = '+(atkBase+healthy['atkAdd']).toFixed(0));
	sc.innerHTML+=p('暴击率 暴击伤害 CRIT:')+div((100*healthy['critRate']).toFixed(0)+'%+'+(100*healthy['critDmg']).toFixed(0)+"%");
	sc.innerHTML+=p('修正分数增量 Fixed:')+div(fixVal.toFixed(FixNum),fixVal/maxA>1?1:fixVal/maxA,fixColor)+'<br>';

	ex.innerHTML=h("偏导数/偏增量(每份副词条) Partial Derivative：");
	colum("攻击力百分比 ATK.Rate: ",exp['atk'],green,maxA);
	colum("攻击力 ATK: ",exp['atkSmall'],green,maxA);
	colum("元素精通.增幅 下位元素1.5 上位元素2.0 Elemental Mastery: ",exp['elemMastery'],green,maxA);
	colum("暴击率 CRIT.Rate: ",exp['critRate'],green,maxA);
	colum("暴击伤害 CRIT.DMG: ",exp['critDmg'],green,maxA);
	ex.innerHTML+="<br>";

	ex.innerHTML+=h("元素精通90级剧变 (单次触发) Elemental Mastery: ");
	colum("扩散*2.044(风套:60%伤害 40%减抗) 可能触发其他剧变",expEM['Overloaded']*0.3*2.044,orange,maxB);
	colum("超载 火伤 爆炸削韧",expEM['Overloaded'],orange,maxB);
	colum("感电 共存 连续反应",expEM['Overloaded']*0.6,orange,maxB);
	colum("超导 冰伤 40%减抗",expEM['Overloaded']*0.25,orange,maxB);
	colum("冻结 碎冰",expEM['Overloaded']*0.75,orange,maxB);
}
function colum(text,num,color,max){
	ex.innerHTML+=p(text)+DIV(num,num/max,color);
}
function bar(text,num){
	ex.innerHTML+=p(text)+DIV(num);
}
function div(text,rate=1,color='#f9f9f9'){
	return  '<div class="bg">'+
				'<p class="num" style="width:'+(100*rate)+'%;background:'+color+';">'+
					text+
				'</p>'+
			'</div>';
}
function DIV(text,rate=1,color='#f9f9f9'){
	if(!isNaN(parseFloat(text)))
		text=text.toFixed(FixNum);
	return div(text,rate,color);
}
function h(text){
	return '<h1>'+text+'</h1>';
}
function p(text){
	return '<p>'+text+'</p>';
}


//操作函数 保留
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