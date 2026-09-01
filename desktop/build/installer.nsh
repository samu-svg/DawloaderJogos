!macro customInstall
  ; Handler com "%1" entre aspas — sem isso o Windows corta montahd://… no primeiro &.
  WriteRegStr HKCU "Software\Classes\montahd" "" "URL:MontaHD Protocol"
  WriteRegStr HKCU "Software\Classes\montahd" "URL Protocol" ""
  WriteRegStr HKCU "Software\Classes\montahd\DefaultIcon" "" "$INSTDIR\${APP_EXECUTABLE_FILENAME},0"
  WriteRegStr HKCU "Software\Classes\montahd\shell\open\command" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "%1"'
!macroend
