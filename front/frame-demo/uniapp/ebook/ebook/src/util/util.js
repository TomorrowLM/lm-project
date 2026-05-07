export default function(state,str){
	let a = state;
	 a = uni.getStorageSync(str)
	 state = a; 
}