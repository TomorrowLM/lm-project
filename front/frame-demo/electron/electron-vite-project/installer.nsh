!include nsDialogs.nsh
!include LogicLib.nsh

#OutFile nsDialogs.exe
#RequestExecutionLevel user
#ShowInstDetails show

Var Dialog
Var name
Var entry
Var website
Var openMode

Page custom pgPageCreate pgPageLeave

Function pgPageCreate

    nsDialogs::Create 1018
    Pop $Dialog

    ${If} $Dialog == error
        Abort
    ${EndIf}

    ${NSD_CreateGroupBox} 10% 10u 80% 100u "Settings"
    Pop $0

        ${NSD_CreateLabel} 20% 26u 20% 10u "name:"
        Pop $0

        ${NSD_CreateText} 40% 24u 40% 12u "electron"
        Pop $name

        ${NSD_CreateLabel} 20% 40u 20% 10u "entry:"
        Pop $0

        ${NSD_CreateText} 40% 38u 40% 12u "https://www.baidu.com"
        Pop $entry

        ${NSD_CreateLabel} 20% 54u 20% 10u "website:"
        Pop $0

        ${NSD_CreateText} 40% 52u 40% 12u "https://www.baidu.com"
        Pop $website
        
        ${NSD_CreateLabel} 20% 68u 20% 10u "openMode:"
        Pop $0

        ${NSD_CreateText} 40% 66u 40% 12u "false"
        Pop $openMode

    nsDialogs::Show
FunctionEnd

Function PgPageLeave
    ${NSD_GetText} $name $0
    ${NSD_GetText} $entry $1
    ${NSD_GetText} $website $2
    ${NSD_GetText} $openMode $3

    FileOpen $9 $DESKTOP\.electron w
    FileWrite $9 "{name:$0,entry:$1,website:$2,openMode:$3}"
    FileClose $9
    SetFileAttributes $DESKTOP\.electron NORMAL
FunctionEnd

Section
SectionEnd