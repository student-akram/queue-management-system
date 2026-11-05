const express=require('express');
const app=express();
app.get('/',(req,resp)=>{
    resp.end("Working");
})
app.listen(5000,()=>{
    console.log(" Server is completely working " );
})