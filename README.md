# PrisML

                     _ _
                    / | \
     OCaml   ~~~>  /  |  \  ~~~> ReasonML
    ReasonML <~~~ /___|___\ <~~~ OCaml

Write ReasonML through the **OCaml prism**.
Write OCaml through the **ReasonML prism**.

## Description

**PrisML is a VSCode extension** for OCaml and ReasonML developers. It gives you the ability to work on both syntax using only the one you're familiar with.

PrisML is just a layer over **refmt**, developped by the authors of [facebook/reason](https://github.com/facebook/reason).

## Development

This project is a work in progress. Right now it's roughly doing a readonly job.
To take a look at the extension:

- Clone this project
- Install the dependencies using `yarn`
- Open the project using VSCode _(make sure you have VSCode version >= 1.33.0)_
- In the menu, click on "Debug" -> "Start Debugging"
- In the new VSCode window, open the command search bar (Ctrl-Shift-P or Cmd-Shift-P) and type "prisml". You should see one command, click on it.
- It will open the same UI it opens when you want to open a folder. So choose an OCaml project _(personally I tested with [glennsl/bs-jest](https://github.com/glennsl/bs-jest))_

You should see the chosen folder in VSCode explorer. The OCaml files should be seen with `_ml.re` extension instead of `.ml`. When you open them, you should see Reason syntax instead of OCaml.
