/** Keyboard state follows viewport geometry, never retained input focus alone. */
export function keyboardIsVisible(baseline:number,current:number,editing:boolean){return editing && baseline-current>Math.min(120,baseline*.18);}
