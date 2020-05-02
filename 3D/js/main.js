// 神奇的事情发生了(*╹▽╹*)
var timer=setInterval(frame,100);
var pos=0;
function frame(){
	pos+=1;
	back.style.transform="rotateY("+(0+pos)+"deg) translateZ(-100px)";
	left.style.transform="rotateY("+(90+pos)+"deg) translateZ(-100px)";
	front.style.transform="rotateY("+(180+pos)+"deg) translateZ(-100px)";
	right.style.transform="rotateY("+(-90+pos)+"deg) translateZ(-100px)";

	top1.style.transform="rotateX(-90deg) rotateZ("+(pos)+"deg) translateZ(-100px)";
	bottom.style.transform="rotateX(90deg) rotateZ("+(-pos)+"deg) translateZ(-100px)";

	text.style.transform="rotateY("+(1.5*pos)+"deg)";
}