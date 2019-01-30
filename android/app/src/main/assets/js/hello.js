function sayHello(){
    document.getElementById("answer").innerHTML = "Hello there";
}

function callGetStringIndirect(){
    string = window.MainHandler.getString("test");
    document.getElementById('string1').innerHTML = string;
}

function helloFromJavascript(){
    document.getElementById('string2').innerHTML = "Hello from javascript";
}
