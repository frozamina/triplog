"""Dependency-free Android SDK build. Requires JDK 17+ and SDK build-tools 35/platform 35.
Set JAVA_HOME, ANDROID_HOME, TRIPLOG_KEYSTORE, TRIPLOG_STORE_PASSWORD,
TRIPLOG_KEY_PASSWORD. No key is generated implicitly.
"""
import os, pathlib, subprocess, zipfile, sys, shutil
root=pathlib.Path(__file__).resolve().parents[1]
sdk=pathlib.Path(os.environ['ANDROID_HOME']);jdk=pathlib.Path(os.environ['JAVA_HOME'])
bt=sdk/'build-tools'/'35.0.0';android=sdk/'platforms'/'android-35'/'android.jar'
build=root/'app'/'build'/'sdk';build.mkdir(parents=True,exist_ok=True)
java=str(jdk/'bin'/'java.exe') if os.name=='nt' else str(jdk/'bin'/'java')
def tool(name):return str(bt/(name+('.exe' if os.name=='nt' else '')))
def run(*args):
 r=subprocess.run([str(x) for x in args],cwd=root)
 if r.returncode:sys.exit(r.returncode)
src=root/'app'/'src'/'main';gen=build/'gen';gen.mkdir(exist_ok=True)
run(tool('aapt2'),'compile','--dir',src/'res','-o',build/'resources.zip')
manifest=src/'AndroidManifest.xml';text=manifest.read_text(encoding='utf-8').replace('<manifest ', '<manifest package="com.frozamina.triplog" android:versionCode="'+os.getenv('TRIPLOG_VERSION_CODE','10')+'" android:versionName="'+os.getenv('TRIPLOG_VERSION_NAME','1.1.8')+'" ')
text=text.replace('<application ', '<uses-sdk android:minSdkVersion="26" android:targetSdkVersion="35"/><application ')
(build/'AndroidManifest.xml').write_text(text,encoding='utf-8')
run(tool('aapt2'),'link','-o',build/'unsigned.apk','--manifest',build/'AndroidManifest.xml','-I',android,'--java',gen,'-A',src/'assets',build/'resources.zip')
classes=build/'classes';classes.mkdir(exist_ok=True)
sources=list((src/'java').rglob('*.java'))+list(gen.rglob('*.java'))
javac=jdk/'bin'/('javac.exe' if os.name=='nt' else 'javac')
run(javac,'-encoding','UTF-8','-source','8','-target','8','-bootclasspath',str(android)+os.pathsep+str(bt/'core-lambda-stubs.jar'),'-d',classes,*sources)
dex=build/'dex';dex.mkdir(exist_ok=True)
run(java,'-cp',bt/'lib'/'d8.jar','com.android.tools.r8.D8','--release','--min-api','26','--lib',android,'--output',dex,*classes.rglob('*.class'))
# Repack entries rather than appending: keep ZIP local and central header flags
# consistent for Android's asset loader, preserving stored resources.arsc.
with zipfile.ZipFile(build/'unsigned.apk','r') as source, zipfile.ZipFile(build/'repacked.apk','w') as target:
 for entry in source.infolist():
  if not entry.filename.endswith('.dex'):target.writestr(entry.filename,source.read(entry.filename),compress_type=entry.compress_type)
 for p in dex.glob('*.dex'):target.write(p,p.name,compress_type=zipfile.ZIP_DEFLATED)
os.replace(build/'repacked.apk',build/'unsigned.apk')
run(tool('zipalign'),'-f','-P','16','4',build/'unsigned.apk',build/'aligned.apk')
out=root.parent/('TripLog-'+os.getenv('TRIPLOG_VERSION_NAME','1.1.8')+'.apk')
run(java,'-jar',bt/'lib'/'apksigner.jar','sign','--ks',os.environ['TRIPLOG_KEYSTORE'],'--ks-key-alias','triplog','--ks-pass','env:TRIPLOG_STORE_PASSWORD','--key-pass','env:TRIPLOG_KEY_PASSWORD','--out',out,build/'aligned.apk')
run(java,'-jar',bt/'lib'/'apksigner.jar','verify','--verbose','--print-certs',out)
print('APK:',out)
