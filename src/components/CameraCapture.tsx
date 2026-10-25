import React,{useEffect,useRef,useState} from 'react';
import {View,Modal,Pressable,Image,ActivityIndicator,useWindowDimensions} from 'react-native';
import Animated,{useSharedValue,useAnimatedStyle,withTiming,Easing,runOnJS} from 'react-native-reanimated';
import {useTheme} from '../theme';
import {CameraView,useCameraPermissions,CameraType} from 'expo-camera';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Upload} from '../data/types';
import {Button,Icon,Txt,IconButton} from './ui';
export function CameraCapture({onClose,onCapture}:{onClose:()=>void;onCapture:(file:Upload)=>Promise<void>}){
  const camera=useRef<CameraView>(null),insets=useSafeAreaInsets();
  const {calm}=useTheme();const {height}=useWindowDimensions();const panelHeight=Math.min(680,Math.max(340,height*.72));
  const progress=useSharedValue(0),closing=useRef(false);
  useEffect(()=>{progress.value=withTiming(1,{duration:calm?0:280,easing:Easing.out(Easing.cubic)});},[]);
  const panelStyle=useAnimatedStyle(()=>({transform:[{translateY:(1-progress.value)*(panelHeight+40)}]}));
  const backdropStyle=useAnimatedStyle(()=>({opacity:progress.value*.42}));
  function close(){if(closing.current||busy)return;closing.current=true;progress.value=withTiming(0,{duration:calm?0:210,easing:Easing.in(Easing.cubic)},finished=>{if(finished)runOnJS(onClose)();});}
  const [permission,requestPermission]=useCameraPermissions();
  const [facing,setFacing]=useState<CameraType>('back'),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[photo,setPhoto]=useState(''),[error,setError]=useState('');
  async function take(){if(!ready||busy)return;setBusy(true);setError('');try{const picture=await camera.current?.takePictureAsync({quality:.8,exif:false});if(!picture?.uri)throw Error('The camera could not capture this photo.');setPhoto(picture.uri);}catch(e){setError(e instanceof Error?e.message:'The camera is unavailable.');}finally{setBusy(false);}}
  async function usePhoto(){setBusy(true);try{await onCapture({uri:photo,name:`photo-${Date.now()}.jpg`,mimeType:'image/jpeg'});closing.current=true;progress.value=withTiming(0,{duration:calm?0:210},finished=>{if(finished)runOnJS(onClose)();});}catch(e){setError(e instanceof Error?e.message:'The photo could not be attached.');}finally{setBusy(false);}}
  return <Modal transparent animationType="none" statusBarTranslucent onRequestClose={close}><View style={{flex:1,justifyContent:'flex-end'}}>
    <Animated.View pointerEvents="none" style={[{position:'absolute',inset:0,backgroundColor:'#000'},backdropStyle]}/>
    <Pressable accessibilityRole="button" accessibilityLabel="Close camera" onPress={close} style={{position:'absolute',inset:0}}/>
    <Animated.View style={[{height:panelHeight,maxWidth:460,width:'100%',alignSelf:'center',borderTopLeftRadius:32,borderTopRightRadius:32,overflow:'hidden',backgroundColor:'#101010',paddingBottom:Math.max(insets.bottom,12)},panelStyle]}>
    <View style={{width:36,height:4,borderRadius:2,backgroundColor:'#FFFFFF45',alignSelf:'center',marginTop:10}}/>
    <View style={{height:54,paddingHorizontal:16,flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}><IconButton name="x" label="Close camera" color="#FFF" onPress={close}/><Txt bold style={{color:'#FFF'}}>Camera</Txt><View style={{width:44}}/></View>
    {!permission?<ActivityIndicator color="#FFF"/>:!permission.granted?<View style={{flex:1,justifyContent:'center',padding:32,gap:22,alignItems:'center'}}><Icon name="camera" size={48} color="#FFF"/><Txt size={24} bold style={{color:'#FFF',textAlign:'center'}}>A photo, right here.</Txt><Txt style={{color:'#D1D1CB',textAlign:'center'}}>Allow camera access to take a photo without leaving curdr.</Txt>{permission.canAskAgain?<Button onPress={()=>void requestPermission()}>Enable camera</Button>:<Txt style={{color:'#D1D1CB'}}>Enable camera permission in your device or browser settings.</Txt>}</View>:<>
    <View style={{flex:1,marginHorizontal:12,borderRadius:30,overflow:'hidden',backgroundColor:'#202020'}}>{photo?<Image source={{uri:photo}} style={{flex:1}} resizeMode="contain"/>:<CameraView key={facing} ref={camera} style={{flex:1}} facing={facing} mode="picture" mirror={facing==='front'} autofocus="on" onCameraReady={()=>setReady(true)} onMountError={({message})=>{setReady(false);setError(message||'Camera unavailable. Try Photos instead.');}}/>}</View>
    {!!error&&<Txt size={14} style={{color:'#F5C4AE',padding:16,textAlign:'center'}}>{error}</Txt>}
    <View style={{height:108,flexDirection:'row',alignItems:'center',justifyContent:'space-around',paddingHorizontal:24}}>{photo?<><Button disabled={busy} onPress={()=>{setPhoto('');setReady(false);}}>Retake</Button><Button loading={busy} onPress={()=>void usePhoto()}>Use photo</Button></>:<><View style={{width:48}}/><Pressable accessibilityRole="button" accessibilityLabel="Take photo" disabled={!ready||busy} onPress={()=>void take()} style={{width:78,height:78,borderRadius:39,borderWidth:3,borderColor:'#FFF',padding:5,opacity:ready?1:.4}}><View style={{flex:1,borderRadius:35,backgroundColor:'#FFF',alignItems:'center',justifyContent:'center'}}>{busy&&<ActivityIndicator color="#111"/>}</View></Pressable><IconButton name="replay" label="Switch camera" color="#FFF" onPress={()=>{setReady(false);setFacing(value=>value==='back'?'front':'back');}}/></>}</View>
    </>}
  </Animated.View></View></Modal>;
}
