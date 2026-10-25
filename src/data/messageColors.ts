export function messageInk(hex:string):string {
  if(!/^#[0-9a-f]{6}$/i.test(hex))return '#141412';
  const channels=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
  const luminance=channels[0]!*.2126+channels[1]!*.7152+channels[2]!*.0722;
  return (luminance+.05)/.05 >= 1.05/(luminance+.05)?'#141412':'#FFFFFF';
}
