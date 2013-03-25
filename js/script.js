$(document).ready(function(){
	var Queue = function(){
		var Node = function(data, next){
			var that = {};
			that.data = data;
			that.next = next;
			return that;
		}
		var that = {};
		var rear = null; /* circular linked list */
		that.enqueue = function(data){
			var newNode = new Node(data, null);
			if(rear == null){
				rear = newNode;
				rear.next = rear;
			}
			else{
				newNode.next = rear.next;
				rear.next = newNode;
				rear = newNode;
			}
		};
		that.dequeue = function(){
			if(rear == null){
				return null;
			}
			else if(rear.next == rear){
				/* queue of 1 element */
				var node = rear;
				rear = null;
				return node.data;
			}
			else{
				/* return front node */
				var node = rear.next;
				rear.next = rear.next.next;
				return node.data;
			}
		};

		that.hasItems = function(){
			return rear != null;
		};

		that.clear = function(){
			rear = null;
		};

		return that;
	};
	var SUDOKU = (function(){
			var that = {};
			var curBox = null;//holds the current box object the user is focused on
			var invalidTextBox = null; //holds the current textbox with an invalid value (if there is any)
			var solveIncrementally = false;
			var ui; //contains all ui elements
			var errorBox // holds the box with the error
			var solving = false; /* locks the solving function */
			var stepQueue = null; /* queue of steps used for animations */
			var feedbackTimer = null;
			var boxStorage = new Array(81);/*array of boxes, defined as follows:
				{
					val: <number>
					textbox: <textbox>
					x: <number>
					y: <number>
					userentered: <number>
				}
			*/
			function parseLink(){
				//link query has following syntax
				//<url>?<x-coord><y-coord><val><x-coord><y-coord><val>...
				var invalidSyntax = "The link to this page does not have correct syntax";
				//user passed in coordinates
				var coords = window.location.search.substring(1);
				if(coords.length % 3 != 0){
					showFeedback(invalidSyntax, 'e');
				}
				for(var i = 0; i < coords.length; i+=3){
					//update box, check validity
					var x = coords.charAt(i);
					var y = coords.charAt(i+1);
					var val = coords.charAt(i+2);
					if(isNaN(x) || isNaN(y) || isNaN(val)){
						showFeedback(invalidSyntax, 'e');	
						break;
					}
					var box = getBox(x, y);
					box.val = val;
					box.userentered = true;
					$(box.textbox).val(val);

					if(!isValid(box)){
						showFeedback(invalidSyntax, 'e');
						$(box.textbox).addClass("error");
						break;
					}
					else{
						$(box.textbox).addClass("userentered")
					}
				}
				createLink();
			}
			function createLink(){
				var link = $(ui.link);
				var str = link.attr("data-website") + "?";
				//go through boxes
				for(var i = 0; i < boxStorage.length; i++){
					if(boxStorage[i].userentered){
						console.log(boxStorage[i]);
						str += "" + boxStorage[i].x + boxStorage[i].y + boxStorage[i].val;
					}
				}
				link.val(str);
			}
			function get(x,y){
				return boxStorage[y * 9 + x].val;
			}
			function set(x,y,val){
				boxStorage[y * 9 + x].val = val;
			}
			function getBox(x,y){
				x = parseInt(x);
				y = parseInt(y);
				//console.log(y * 9 + x);
				//console.log(boxStorage[y * 9 + x]);
				//console.log(boxStorage);
				return boxStorage[y * 9 + x];
			}
			/* gets the next sequential box */
			function getNextBox(box){
				var x = box.x;
				var y = box.y;
				if(x == 8){
					x = 0;
					y++;
				}
				else{
					x++;
				}

				if(y > 8){
					return null;
				}
				else{
					return getBox(x,y);
				}
			}
			/* sets both the internal value and the textbox value
				therefore the user can see the changes
			*/
			function setBox(x,y,val){
				$(boxStorage[y * 9 + x]).val(val);
				set(x,y,val);
			}
			//wipes all boxes
			function clear(){
				if(isLocked()){
					//make animation stop
					stepQueue.clear(); //removes rest of steps to animate
					lock(false);
					return;
				}
				errorBox = null;
				for(var i = 0; i < boxStorage.length; i++){
					$(boxStorage[i].textbox).removeClass().val("");
					boxStorage[i].val = null;
					boxStorage[i].userentered = false;
				}
			}
			function textBoxFocus(e){
				var targ = $(e.target);
				var parent = targ.parent();


				curBox = getBox(parent.attr("data-x"), parent.attr("data-y"));
				if(isNaN(targ.val()) || targ.val() == "0"){
					targ.val("");//clear it
					curBox.val = null;
				}
			}
			function textBoxBlur(e){
				//check if the box blurred is the current box
				if(curBox != null && curBox.textbox == e.target){
					//validate
					validate(curBox.x, curBox.y);
					curBox = null;
				}
				createLink();
			}
			function showFeedback(msg, type){
				feedbackTimer = window.clearTimeout(feedbackTimer);
				$(ui.feedback).html(msg).removeClass().addClass(type).fadeIn();
				feedbackTimer = window.setTimeout(function(){$(ui.feedback).fadeOut();}, 7500);
			}
			function navigateFocus(dir){
				//get the current x-y coordinates that the user is in
				var curx = curBox.x,
					cury = curBox.y; 
				switch(dir){
					case 37:
						curx--;
					break;
					case 38:
						cury--;
					break;
					case 39:
						curx++;
					break;
					case 40:
						cury++;
					break;
					default:
						return;//nope
					break;
				}
				if(curx < 0 || curx > 8 || cury < 0 || cury > 8){
					return;//invalid
				}
				//otherwise focus on the new one
				$(getBox(curx, cury).textbox).focus();
			}
			/* locks/unlocks solve function from access */
			function lock(val){
				solving = val;

				if(val){
					$(ui.btnSolve).fadeOut();
					$(ui.btnClear).html("Stop");
				}
				else{
					$(ui.btnSolve).fadeIn();
					$(ui.btnClear).html("Clear");
				}
			}
			function isLocked(){
				return solving;
			}
			/* called by pressing the solve button */
			function solve(){
				
				//validate
				if(!validate()){
					return;
				}
				//good to go, lock the function
				if(isLocked()){return false;}
				lock(true);	

				stepQueue = null;
				//check if user wants animation
				if($(ui.checkbox).is(":checked")){
					stepQueue = new Queue();
				}

				//recursively solve this
				var result = recursiveSolve(getBox(0,0), stepQueue);
				if(result){
					if(stepQueue != null){
						//show all individual steps
						showStep(stepQueue);//stepQueue will unlock solve when finished
					}
					else{
						// if not showing all steps, just update immediately 
						//update all textboxes
						for(var i = 0; i < boxStorage.length; i++){
							$(boxStorage[i].textbox).val(boxStorage[i].val);
						}
						lock(false);//unlock solve
					}
				}
				else{
					console.log("No solutions");
					lock(false);//unlock solve
				}
			}

			function showStep(stepQueue){
				if(!stepQueue.hasItems()){
					//base case reached
					lock(false);
					return;
				}
				var step = stepQueue.dequeue();
				//set the textbox
				if(step.val != null){
					$(step.box.textbox).val(step.val);
				}
				else{
					$(step.box.textbox).val("");
				}
				setTimeout(function(){showStep(stepQueue);}, 50);
			}

			function recursiveSolve(curBox, stepQueue){
				if(curBox == null){
					return true;//finished
				}
				//check if it is userentered, because user entered boxes are uneditable
				if(!curBox.userentered){
					//set it until it is valid
					for(var i = 1; i <= 9; i++){
						curBox.val = i;
						if(!isValid(curBox)){
							continue;
						}
						if(stepQueue != null){
							//add to stepQueue
							stepQueue.enqueue({box: curBox, val: i});
						}
						if(recursiveSolve(getNextBox(curBox), stepQueue)){
							//this value works!
							return true;
						}
					}
					//no values work, must backtrack
					curBox.val = null;
					if(stepQueue != null){
							//add to stepQueue
							stepQueue.enqueue({box: curBox, val: null});
					}
					return false;
				}
				else{
					//skip to the next one
					return recursiveSolve(getNextBox(curBox), stepQueue);
				}
			}
			function isValidNum(n){
				n = parseInt(n);
				return n > 0 && n <= 9;
			}
			/*
			 box is the box object
			 returns boolean
			 */
			function isValid(box){
				//check if the box value is valid
				var bVal = box.val; 
				if(isValidNum(bVal)){
					box.val = bVal;
				}
				else if(bVal == null){
					return true;
				}
				// check all other numbers in this row and
				// check all other numbers in this column 
				for(var i = 0; i < 9; i++){
					var rowVal = getBox(i,box.y).val,
					colVal = getBox(box.x, i).val;
					if(rowVal && rowVal == box.val && i != box.x){
						return false;
					}
					if(colVal && colVal == box.val && i != box.y){
						return false;
					}
				}

				// check all other things in this 3x3 box 
				var xTridant = Math.ceil((box.x + 1) / 3) - 1, // gets 0, 1, or 2
				yTridant = Math.ceil((box.y + 1) / 3) - 1,
				xOff = xTridant * 3,
				yOff = yTridant * 3;

				for(var i = xOff; i < xOff + 3; i++){
					for(var j = yOff; j < yOff + 3; j++){
						if(getBox(i, j).val == box.val && !(i == box.x && j == box.y)){
							return false;
						}
					}
				}

				return true;
			}
			/* if called with x,y parameters, the box at x,y is validated
				otherwise all boxes are validated,
				gives feedback on errors
			*/
			function validate(x,y){

				if(x != null && y != null){
					//just validate one box

					var box = getBox(x,y);
					if(errorBox != null && box != errorBox){
						/* no point to check if there is already error */
						return false;	
					}
					else if(!isValid(box)){
						/*
						 * only go add an error to this box if other errors do not exist already
						 * mainly because there is no point in showing more than one real time error
						 * because many errors can be caused by one bad number
						 */
						errorBox = box;
					}
					else{
						//the errorbox has been fixed
						$(box.textbox).removeClass("error");
						errorBox = null;
						return validate();
						return true;
					}
				}
				else{
					/*go through each box and check
					ignore errorBox just in case program thinks there is an error
					when there really isn't
					*/

					errorBox = null;//set to null initially
					for(var i = 0; i < 81; i++){
						var val = $(boxStorage[i].textbox).val();
						if(!isValid(boxStorage[i])){
							errorBox = boxStorage[i];
							break;
						}
						else{
							$(boxStorage[i].textbox).removeClass("error");	
						}
					}
				}

				if(errorBox != null){
					$(errorBox.textbox).addClass("error");
					return false;
				}
				else{
					return true;	
				}
			}

			function initUI(){
				var c = ui.container; //shorter variable name
				//create all boxes, and set up click events
				var frag = document.createDocumentFragment();
				for(var i = 0; i < 9; i++){
					for(var j = 0; j < 9; j++){
						//create body in jquery
						var box = $("<div>").addClass("box").attr("data-x", j).attr("data-y", i)[0],
							text = $("<input>").attr("type", "text").attr("maxlength", "1").on("focus", textBoxFocus).on("blur", textBoxBlur)[0];
						boxStorage[i * 9 + j] = {textbox: text, val: null, x: j, y: i};
						box.appendChild(text);
						frag.appendChild(box);
					}
				}
				c.appendChild(frag);
				//check if there are values in the link
				if(window.location.search){
					parseLink();
				}
				$(c).on("click", function(e){
					var targ = $(e.target);
					if(targ.hasClass("box")){
						targ.find("input").focus();
					}
				}).on("keydown", function(e){
					if(isLocked()){
						//ignore any keypresses when locked
						e.preventDefault();
						e.stopPropagation();
						return false;	
					}
					if(curBox != null){
					//	console.log(e.which);
						//ok then user might be trying to input a number
						//check if key is legit
						var character = String.fromCharCode(e.which);
						if(isValidNum(character)){
							//valid numeric 1-9
							$(curBox.textbox).val(character);
							curBox.userentered = true;
							$(curBox.textbox).addClass("userentered");
							curBox.val = parseInt(character);
						}
						else{
							e.preventDefault();
							e.stopPropagation();
							//check if arrow key
							if(e.which >= 37 && e.which <= 40){
								navigateFocus(e.which);
							}
							else if(e.which == 8 || e.which == 46){
								//delete/backspace
								$(curBox.textbox).val("");
								$(curBox.textbox).removeClass("userentered");
								curBox.val = null;
								curBox.userentered = false;
							}
							return false;
						}

					}
				});
				//set up click event for solve button
				$(ui.btnSolve).click(solve);
				$(ui.btnClear).click(clear);
				$(ui.btnSettings).click(function(){$(ui.popupSettings).toggle();});				
			}
			that.init = function(stg){
				var requiredProps = ["container", "btnSolve", "btnClear", "btnSettings", "checkbox", "popupSettings", "feedback", "link"];
				ui = stg;
				//validate that all required properties are here
				for(var i = 0; i < requiredProps.length; i++){
					if(!ui.hasOwnProperty(requiredProps[i])){
						alert("Missing property: " + requiredProps[i]);
						return;
					}
				}
				//all properties accounted for
				initUI();
			}
			return that;
	}());
	SUDOKU.init(
		{
			container: document.getElementById("sudoku"),
			feedback: document.getElementById("feedback"),
			link: document.getElementById("link"),
			btnSolve: document.getElementById("solve"),
			btnClear: document.getElementById("clear"),
			btnSettings: document.getElementById("settings"),
			popupSettings: document.getElementById("settings_popup"),
			checkbox: document.getElementById("show")
		}
	); 
});