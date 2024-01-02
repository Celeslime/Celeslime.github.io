var timer;
if(localStorage.vis){
	hello.style.display="none";
}
else{
	// head.style.top="-124px";
	// duck.style.display="none";
	// duck.style.
	main.style.filter="blur(10px)";
}
function getIn(){
	localStorage.setItem("vis",true);
	hello.style.opacity ="0";
	timer=setInterval(dsp,300);
	// duck.style.display='block';
	// duck.style.opacity='1';
	main.style.filter="blur(0px)";
}
function dsp(){
	hello.style.display="none";

	console.log("visited!");
	// localStorage.vis="";

	clearInterval(timer);
	// head.style.top="0px";
}