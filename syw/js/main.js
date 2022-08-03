// 奇妙的事情发生了 o‿≖✧
var atkBase,atkAdd,critRate,critDmg,elemMastery;
var exp=new Array(),expEM=new Array(),healthy=new Array();
var expBase,expEMBase;
var maxA=0,maxB=0,RATIO=2.00;

//以下数据由副词套保留两位小数后取平均值获得
// var A=0.0496, //攻击力百分比
// 	B=0.033,  //啧
// 	C=0.066,  //啧啧
// 	D=16.535, //攻击力
// 	E=19.815 ;//精通
//以下数据由副词矫正获得
var A=3/60,   //攻击力百分比
	B=2/60,   //暴击率
	C=4/60,   //暴击伤害
	D=1000/60,//小攻击
	E=1200/60;//元素精通

//结果保留位数
var FixNum=1;
//搞颜色(*/ω＼*)
var yellow='#ffa',
 	red='#fba',
 	orange='#fec',
 	green='#afd';
//交互
function onKeyUp(){
	getValues();
	check();
	calc();
	print();
	console.log("done")
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
//var timer=setInterval(onKeyUp,100);


//算法
function calc(){
	expBase=getExp(atkBase+atkAdd,critRate,critDmg,elemMastery);
	//虽说是偏导数，但...的效果会更好
	exp['atk']=getExp(atkBase*(1+A)+atkAdd,critRate,critDmg,elemMastery)-expBase;
	exp['atkSmall']=getExp(atkBase+atkAdd+D,critRate,critDmg,elemMastery)-expBase;
	exp['elemMastery']=getExp(atkBase+atkAdd,critRate,critDmg,elemMastery+E)-expBase;
	exp['critRate']=getExp(atkBase+atkAdd,critRate+B,critDmg,elemMastery)-expBase;
	exp['critDmg']=getExp(atkBase+atkAdd,critRate,critDmg+C,elemMastery)-expBase;
	getMaxA();
	//在这里以超载为一个基准量
	expEMBase=getOverloaded(elemMastery);
	expEM['Overloaded']=expEMBase*1.4*(1-0.2);//超载
	expEM['Swirl']=expEMBase*0.3*1.6*(1+0.1);//扩散
	expEM['ElectroCharged']=expEMBase*0.6*1.4*(1-0.2);//感电
	expEM['Superconduct']=expEMBase*0.25*1.4*(1-0.2);//超导
	expEM['Frozen']=expEMBase*0.75*(1-0.2);//碎冰
	maxB=expEM['Overloaded']*1.4*0.8;

	//这里用拉格朗日约束的一个推导
	var scouce=(atkAdd/atkBase)/A+critRate/B+critDmg/C;
	var scouceFull=scouce-1/B;

	var expAllATK=getExp(1+A*(scouce-0.05/B-0.50/C),0.05,0.50,0);

	var s2=1/A+scouce,s3=1/B/C;
	var hRate=(s2+Math.sqrt(s2*s2-12*s3))/6,hATK=scouce-2*hRate;

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
/****元素精通****/
function getEMRate(elemMastery){
	return 25/9*elemMastery/(elemMastery+1400);
}
function getOverloaded(elemMastery){
	return 2893*(1+16*elemMastery/(elemMastery+2000));
}
/****伤害****/
function getExp(atk,cR,cD,eM){
	if(cR>1)cR=1;
	if(cR<0)cR=0;
	return atk*(1+cR*cD)*(1+getEMRate(eM));
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
		maxA*=1.1
	}
	sc.innerHTML+=h("修正数据 Fixed:");
	sc.innerHTML+=p('攻击力 ATK:')+div(atkBase+' + '+healthy['atkAdd'].toFixed(0)+' = '+(atkBase+healthy['atkAdd']).toFixed(0));
	sc.innerHTML+=p('暴击率 暴击伤害 CRIT:')+div((100*healthy['critRate']).toFixed(0)+'%+'+(100*healthy['critDmg']).toFixed(0)+"%");
	sc.innerHTML+=p('修正分数增量 Fixed:')+div(fixVal.toFixed(FixNum),fixVal/maxA,fixColor)+'<br>';

	ex.innerHTML=h("偏导数/偏增量(每份副词条) Partial Derivative：");
	colum("攻击力百分比 ATK.Rate: ",exp['atk'],green,maxA);
	colum("攻击力 ATK: ",exp['atkSmall'],green,maxA);
	colum("元素精通.增幅 下位元素1.5 上位元素2.0 Elemental Mastery: ",exp['elemMastery'],green,maxA);
	colum("暴击率 CRIT.Rate: ",exp['critRate'],green,maxA);
	colum("暴击伤害 CRIT.DMG: ",exp['critDmg'],green,maxA);
	ex.innerHTML+="<br>";

	ex.innerHTML+=h("元素精通.剧变伤害 20%抗性(单次触发) Elemental Mastery: ");
	colum("扩散 (风套:60%伤害 40%减抗) 最多两段 可能触发其他剧变",expEM['Swirl'],orange,maxB);
	colum("超载 (如雷/火套:40%伤害) 火伤 爆炸削韧",expEM['Overloaded'],orange,maxB);
	colum("超导 (如雷:40%伤害) 冰伤 减40%物抗",expEM['Superconduct'],orange,maxB);
	colum("冻结 碎冰",expEM['Frozen'],orange,maxB);
	colum("感电 (如雷:40%伤害) 持续反应",expEM['ElectroCharged'],orange,maxB);

}
function colum(text,num,color,max){
	ex.innerHTML+=p(text)+DIV(num,num/max,color);
}
function bar(text,num){
	ex.innerHTML+=p(text)+DIV(num);
}
function div(text,rate=1,color='#f9f9f9'){
	if(rate>1)rate=1;
	if(rate<0)rate=0;
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