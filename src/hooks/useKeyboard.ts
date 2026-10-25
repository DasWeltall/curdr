import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';
import {keyboardIsVisible} from '../data/keyboard';
export function useKeyboard(){
  const [visible,setVisible]=useState(false);
  useEffect(()=>{
    if(Platform.OS!=='web'){
      setVisible(Keyboard.isVisible());
      const show=Keyboard.addListener(Platform.OS==='ios'?'keyboardWillShow':'keyboardDidShow',()=>setVisible(true));
      const hide=Keyboard.addListener(Platform.OS==='ios'?'keyboardWillHide':'keyboardDidHide',()=>setVisible(false));
      return ()=>{show.remove();hide.remove();};
    }
    const viewport=window.visualViewport;
    let baseline=Math.max(window.innerHeight,viewport?.height||0),width=window.innerWidth;
    const update=()=>{
      const height=viewport?.height||window.innerHeight;
      const editing=!!document.activeElement?.matches('input,textarea,[contenteditable="true"]');
      if(Math.abs(window.innerWidth-width)>80){baseline=height;width=window.innerWidth;}
      baseline=Math.max(baseline,height);
      setVisible(keyboardIsVisible(baseline,height,editing));
      document.documentElement.style.setProperty('--curdr-viewport-height',`${height}px`);
    };
    const focus=()=>{baseline=Math.max(baseline,viewport?.height||window.innerHeight);update();};
    viewport?.addEventListener('resize',update);window.addEventListener('resize',update);
    document.addEventListener('focusin',focus);document.addEventListener('focusout',update);update();
    return ()=>{viewport?.removeEventListener('resize',update);window.removeEventListener('resize',update);document.removeEventListener('focusin',focus);document.removeEventListener('focusout',update);};
  },[]);
  return visible;
}
