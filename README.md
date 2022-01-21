# CommentDump V3
This is a tool I developped to assist with web application penetration testing. The tool is a browser extension that works in chromium based browser (chrome, edge, opera, etc.)
The tool allows the analyst to rapidly browse through all comments from the current page and loaded ressource files by isolating them and dumping the output to the developper console.
The tool uses regular expression to identify comments in all formats (inline, multi-line, etc.) and provides the location of the source file for easy reference.
Finally, the tool includes a built-in list of "interesting" keywords that will be highlighted if detected in a comment.
The built-in list can be overriden with custom keywords by supplying a comma separated list to the input box and clicking extract. 

# Installation

1. git clone https://github.com/PN-Tester/commentDump/
2. In chrome, navigate to chrome://extensions
3. select the "Developer mode" switch in the upper left-hand corner
4. Select "Load unpacked" button which appears in upper right-hand corner
5. Select the commentDump folder and hit enter

# Usage
1. open developer tools window and navigate to "console". This is where output from the extension goes.
2. Click the extension icon to open extension pop-up
3. Optionally, enter a comma separated list of keywords to detect in the box labelled "Enter Keywords". Leaving this blank will use default list.
4. Click "extract". Console window is automatically cleared and before results appear.

# Rationale
Over many years of penetration testing web applications, I have noticed that comments are likely to contain sensitive information. 
Comments can contain hardcoded credentials, references to internal systems and identifiers, references to sensitive or deprecated functionality, information about the developpers, etc.
It can be rather time consuming to go through all the sources of a web application manually, and it may be more difficult to detect
patterns when analysis is spread out over multiple pages. This tool exists to allow analysts to quickly profile 
a web application's comments with just 1 click. Based on the content and verbosity of the comments, analysts can quickly determine if the target
application is more likely to contain addtional vulnerabilities. In some scenarios, the tool may identify information disclosure vulnerabilities without further effort.
Finally, the ability to identify interesting keywords was added to assist testers with rapid identification of potential attack vectors during initial content discovery phase.
