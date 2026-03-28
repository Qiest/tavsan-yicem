@echo off
echo Building...
call npx expo export --platform web

echo Copying extra files...
copy assets\icon.png dist\icon.png /Y
copy public\sw.js dist\sw.js /Y
copy public\manifest.json dist\manifest.json /Y

echo Fixing index.html...
for /f "delims=" %%i in ('dir /b dist\_expo\static\js\web\entry-*.js') do set ENTRY=%%i
echo ^<!DOCTYPE html^> > dist\index.html
echo ^<html lang="tr"^> >> dist\index.html
echo   ^<head^> >> dist\index.html
echo     ^<meta charset="utf-8" /^> >> dist\index.html
echo     ^<meta name="viewport" content="width=device-width, initial-scale=1" /^> >> dist\index.html
echo     ^<link rel="manifest" href="/manifest.json" /^> >> dist\index.html
echo     ^<link rel="apple-touch-icon" href="/icon.png" /^> >> dist\index.html
echo     ^<meta name="apple-mobile-web-app-capable" content="yes" /^> >> dist\index.html
echo     ^<meta name="apple-mobile-web-app-title" content="Tavsan" /^> >> dist\index.html
echo     ^<title^>Tavsan^</title^> >> dist\index.html
echo     ^<style id="expo-reset"^>html,body{height:100%;}body{overflow:hidden;}#root{display:flex;height:100%;flex:1;}^</style^> >> dist\index.html
echo   ^</head^> >> dist\index.html
echo   ^<body^> >> dist\index.html
echo     ^<div id="root"^>^</div^> >> dist\index.html
echo     ^<script src="/_expo/static/js/web/%ENTRY%" defer^>^</script^> >> dist\index.html
echo   ^</body^> >> dist\index.html
echo ^</html^> >> dist\index.html

echo Pushing to GitHub...
git add dist\
git commit -m "deploy"
git push

echo Done!
