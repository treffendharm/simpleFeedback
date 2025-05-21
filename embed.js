(function () {
    let currentState = null;
    let comments = [];
    let selectionBox = null;
    let isSelecting = false;
    let startX = 0;
    let startY = 0;
    let referenceScreenSize = { width: 0, height: 0 }; // Reference screen size for scaling
    let isHandlingSelection = false; // New flag to track selection handling

    // Convert absolute position to relative position (percentage of viewport)
    function toRelativePosition(x, y) {
        return {
            xPercent: (x / window.innerWidth) * 100,
            yPercent: (y / window.innerHeight) * 100
        };
    }

    // Convert relative position to absolute position
    function toAbsolutePosition(xPercent, yPercent) {
        return {
            x: (xPercent * window.innerWidth) / 100,
            y: (yPercent * window.innerHeight) / 100
        };
    }

    // Convert dimensions to relative (percentage of viewport)
    function toRelativeDimensions(width, height) {
        return {
            widthPercent: (width / window.innerWidth) * 100,
            heightPercent: (height / window.innerHeight) * 100
        };
    }

    // Convert relative dimensions to absolute
    function toAbsoluteDimensions(widthPercent, heightPercent) {
        return {
            width: (widthPercent * window.innerWidth) / 100,
            height: (heightPercent * window.innerHeight) / 100
        };
    }

    // Store initial screen size
    function storeReferenceScreenSize() {
        referenceScreenSize.width = window.innerWidth;
        referenceScreenSize.height = window.innerHeight;
    }

    // Load saved comments from localStorage
    function loadComments() {
        const savedComments = localStorage.getItem('pageComments');
        if (savedComments) {
            const parsedComments = JSON.parse(savedComments);
            
            // Convert percentage positions back to absolute positions
            comments = parsedComments.map(comment => {
                // If we have percentage coordinates, use them
                if (comment.xPercent !== undefined && comment.yPercent !== undefined) {
                    const absPos = toAbsolutePosition(comment.xPercent, comment.yPercent);
                    comment.x = absPos.x;
                    comment.y = absPos.y;
                }
                
                // If there's selection data with percentages, convert that too
                if (comment.selection && comment.selection.xPercent !== undefined) {
                    const absSelPos = toAbsolutePosition(
                        comment.selection.xPercent, 
                        comment.selection.yPercent
                    );
                    const absSelDim = toAbsoluteDimensions(
                        comment.selection.widthPercent,
                        comment.selection.heightPercent
                    );
                    
                    comment.selection.x = absSelPos.x;
                    comment.selection.y = absSelPos.y;
                    comment.selection.width = absSelDim.width;
                    comment.selection.height = absSelDim.height;
                }
                
                return comment;
            });
            
            // Render all saved comments
            comments.forEach(comment => {
                if (!comment.resolved) {
                    createCommentIcon(comment.x, comment.y, comment.text, comment.id, comment.selection);
                }
            });
        }
    }

    // Save comments to localStorage
    function saveComments() {
        // Convert positions to relative before saving
        const commentsToSave = comments.map(comment => {
            // Create a copy of the comment
            const commentCopy = { ...comment };
            
            // Convert positions to percentages
            const relPos = toRelativePosition(comment.x, comment.y);
            commentCopy.xPercent = relPos.xPercent;
            commentCopy.yPercent = relPos.yPercent;
            
            // If there's selection data, convert that too
            if (comment.selection) {
                const selectionCopy = { ...comment.selection };
                const relSelPos = toRelativePosition(comment.selection.x, comment.selection.y);
                const relSelDim = toRelativeDimensions(comment.selection.width, comment.selection.height);
                
                selectionCopy.xPercent = relSelPos.xPercent;
                selectionCopy.yPercent = relSelPos.yPercent;
                selectionCopy.widthPercent = relSelDim.widthPercent;
                selectionCopy.heightPercent = relSelDim.heightPercent;
                
                commentCopy.selection = selectionCopy;
            }
            
            return commentCopy;
        });
        
        localStorage.setItem('pageComments', JSON.stringify(commentsToSave));
    }

    // Generate a unique ID for comments
    function generateCommentId() {
        return Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    }

    // Handle mousedown for selection
    document.addEventListener('mousedown', (e) => {
        // If we're in comment mode
        if (currentState === 'comment') {
            // Always allow interaction with comment-related elements
            if (e.target.closest('.toolboxContainer') || 
                e.target.closest('.comment-icon') || 
                e.target.closest('.comment-box') ||
                e.target.closest('.comment-tooltip') ||
                e.target.closest('.selection-highlight')) {
                return;
            }
            
            // For main page content, prevent text selection but allow click/drag for comment creation
            if (!e.target.closest('.toolboxContainer') && 
                !e.target.closest('.comment-icon') && 
                !e.target.closest('.comment-box')) {
                
                // Prevent text selection
                e.preventDefault();
                
                // Start selection box
                isSelecting = true;
                startX = e.clientX;
                startY = e.clientY;
                
                // Create selection box
                selectionBox = document.createElement('div');
                selectionBox.className = 'selection-box';
                selectionBox.style.left = startX + 'px';
                selectionBox.style.top = startY + 'px';
                document.body.appendChild(selectionBox);
            }
        }
    });

    // Handle mousemove for selection
    document.addEventListener('mousemove', (e) => {
        if (isSelecting && selectionBox) {
            const width = Math.abs(e.clientX - startX);
            const height = Math.abs(e.clientY - startY);
            
            // Set position based on direction of drag
            selectionBox.style.left = (e.clientX < startX ? e.clientX : startX) + 'px';
            selectionBox.style.top = (e.clientY < startY ? e.clientY : startY) + 'px';
            
            // Set dimensions
            selectionBox.style.width = width + 'px';
            selectionBox.style.height = height + 'px';
        }
    });

    // Handle mouseup for selection
    document.addEventListener('mouseup', (e) => {
        if (isSelecting && selectionBox) {
            isSelecting = false;
            
            // Check if selection has minimum size
            const width = Math.abs(e.clientX - startX);
            const height = Math.abs(e.clientY - startY);
            
            if (width > 10 && height > 10) {
                // Valid selection, show comment box
                const selectionData = {
                    x: parseInt(selectionBox.style.left),
                    y: parseInt(selectionBox.style.top),
                    width: width,
                    height: height
                };
                
                // Set flag to prevent click event
                isHandlingSelection = true;
                
                // Remove temporary selection box
                document.body.removeChild(selectionBox);
                selectionBox = null;
                
                // Show comment box for the selection
                showCommentBox(e.clientX, e.clientY, selectionData);
                
                // Reset flag after a short delay
                setTimeout(() => {
                    isHandlingSelection = false;
                }, 100);
            } else {
                // Too small, remove selection box
                document.body.removeChild(selectionBox);
                selectionBox = null;
            }
        }
    });

    // Show comment box at specified position
    function showCommentBox(x, y, selectionData = null) {
        console.log('Creating comment box at:', { x, y, selectionData });
        
        // Check if there's already a comment box and remove it
        const existingCommentBox = document.querySelector('.comment-box');
        if (existingCommentBox) {
            document.body.removeChild(existingCommentBox);
        }
        
        const commentBox = document.createElement('div');
        commentBox.className = 'comment-box';
        commentBox.style.left = (x + 15) + 'px';
        commentBox.style.top = (y + 15) + 'px';
        
        // Create input container
        const inputContainer = document.createElement('div');
        inputContainer.className = 'comment-input-container';
        // Create textarea for comment
        const textarea = document.createElement('input');
        textarea.type = 'text';
        textarea.placeholder = 'Add your comment here...';
        inputContainer.appendChild(textarea);
        
        // Create actions container
        const actionsContainer = document.createElement('div');
        actionsContainer.className = 'comment-actions-container';
        // Create submit button
        const submitButton = document.createElement('button');
        submitButton.textContent = 'Add Comment';
        submitButton.className = 'submit-btn';
        // Create cancel button
        const cancelButton = document.createElement('button');
        cancelButton.textContent = 'Cancel';
        cancelButton.className = 'cancel-btn';
        actionsContainer.appendChild(submitButton);
        actionsContainer.appendChild(cancelButton);
        
        // Create temporary comment icon with selection highlight
        let tempCommentIcon = null;
        if (selectionData) {
            tempCommentIcon = document.createElement('div');
            tempCommentIcon.className = 'comment-icon';
            tempCommentIcon.style.left = x + 'px';
            tempCommentIcon.style.top = y + 'px';
            
            const tempSelectionHighlight = document.createElement('div');
            tempSelectionHighlight.className = 'selection-highlight temp';
            // Position relative to the comment icon
            const relativeX = selectionData.x - x;
            const relativeY = selectionData.y - y;
            console.log('Temp selection relative position:', { relativeX, relativeY });
            tempSelectionHighlight.style.left = relativeX + 'px';
            tempSelectionHighlight.style.top = relativeY + 'px';
            tempSelectionHighlight.style.width = selectionData.width + 'px';
            tempSelectionHighlight.style.height = selectionData.height + 'px';
            
            tempCommentIcon.appendChild(tempSelectionHighlight);
            document.body.appendChild(tempCommentIcon);
        }
        
        // Add containers to comment box
        commentBox.appendChild(inputContainer);
        commentBox.appendChild(actionsContainer);
        
        // Add comment box to body
        document.body.appendChild(commentBox);
        
        // Focus textarea
        textarea.focus();
        
        // Handle submit button click
        submitButton.addEventListener('click', () => {
            const commentText = textarea.value.trim();
            if (commentText) {
                // Remove the comment box
                document.body.removeChild(commentBox);
                
                // Remove temporary comment icon if it exists
                if (tempCommentIcon && tempCommentIcon.parentNode) {
                    document.body.removeChild(tempCommentIcon);
                }
                
                // Generate unique ID for this comment
                const commentId = generateCommentId();
                
                // Save comment to our array
                const newComment = {
                    id: commentId,
                    x: x,
                    y: y,
                    text: commentText,
                    resolved: false,
                    selection: selectionData
                };
                console.log('Saving new comment:', newComment);
                comments.push(newComment);
                
                // Save to localStorage
                saveComments();
                
                // Create comment icon
                createCommentIcon(x, y, commentText, commentId, selectionData);
            }
        });
        
        // Handle cancel button click
        cancelButton.addEventListener('click', () => {
            document.body.removeChild(commentBox);
            
            // Remove temporary comment icon if it exists
            if (tempCommentIcon && tempCommentIcon.parentNode) {
                document.body.removeChild(tempCommentIcon);
            }
        });
    }

    // Handle click for simple comment creation
    document.addEventListener('click', (e) => {
        // Check if we're in comment mode and the click is not on the toolbox
        // Also check if we're not handling a selection
        if (currentState === 'comment' && 
            !e.target.closest('.toolboxContainer') && 
            !e.target.closest('.comment-icon') && 
            !e.target.closest('.comment-box') && 
            !isSelecting && 
            !isHandlingSelection) {
            
            // Simple click (not drag) - show comment box directly
            showCommentBox(e.clientX, e.clientY);
        }
    });
    
    // Function to create a comment icon
    function createCommentIcon(x, y, commentText, commentId, selectionData = null) {
        const commentIcon = document.createElement('div');
        commentIcon.className = 'comment-icon';
        commentIcon.dataset.id = commentId;
        commentIcon.style.left = x + 'px';
        commentIcon.style.top = y + 'px';
        commentIcon.innerHTML = '<div class="comment-icon-icon"></div>  ';
        
        // Store the comment text as a data attribute
        commentIcon.dataset.comment = commentText;
        
        // If we have selection data, create a selection highlight as a child
        if (selectionData) {
            const selectionHighlight = document.createElement('div');
            selectionHighlight.className = 'selection-highlight';
            // Position relative to the comment icon
            selectionHighlight.style.left = (selectionData.x - x) + 'px';
            selectionHighlight.style.top = (selectionData.y - y) + 'px';
            selectionHighlight.style.width = selectionData.width + 'px';
            selectionHighlight.style.height = selectionData.height + 'px';
            selectionHighlight.dataset.commentId = commentId;
            
            // Make selection always visible for testing
            
            commentIcon.appendChild(selectionHighlight);
        }
        
        // Create tooltip for hover
        const tooltip = document.createElement('div');
        tooltip.className = 'comment-tooltip';
        
        // Make tooltip always visible for testing
        
        // Add comment text
        const commentTextElement = document.createElement('div');
        commentTextElement.className = 'comment-text';
        commentTextElement.textContent = commentText;
        tooltip.appendChild(commentTextElement);
        
        // Add edit functionality to text
        commentTextElement.addEventListener('click', (e) => {
            e.stopPropagation();
            
            // Don't allow multiple edit sessions
            if (commentTextElement.querySelector('.edit-container')) {
                return;
            }
            
            // Create container for edit mode
            const editContainer = document.createElement('div');
            editContainer.className = 'edit-container';
            
            // Create input field
            const input = document.createElement('input');
            input.className = 'edit-comment-input';
            input.value = commentTextElement.textContent;
            
            // Create save button
            const saveButton = document.createElement('button');
            saveButton.className = 'save-edit-btn';
            saveButton.innerHTML = '↑';
            saveButton.title = 'Save (or press Enter)';
            
            // Add input and button to container
            editContainer.appendChild(input);
            editContainer.appendChild(saveButton);
            
            // Replace text with edit container
            commentTextElement.innerHTML = '';
            commentTextElement.appendChild(editContainer);
            
            // Focus input
            input.focus();
            
            // Function to save edit
            const saveEdit = () => {
                const newText = input.value.trim();
                if (newText) {
                    // Update text in DOM
                    commentTextElement.textContent = newText;
                    
                    // Update data attribute
                    commentIcon.dataset.comment = newText;
                    
                    // Update in comments array
                    const commentIndex = comments.findIndex(c => c.id === commentId);
                    if (commentIndex !== -1) {
                        comments[commentIndex].text = newText;
                        saveComments();
                    }
                } else {
                    // If empty, revert to original
                    commentTextElement.textContent = commentIcon.dataset.comment;
                }
            };
            
            // Save on button click
            saveButton.addEventListener('click', (e) => {
                e.stopPropagation();
                saveEdit();
            });
            
            // Save on Enter key
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    saveEdit();
                }
                
                // Cancel on Escape
                if (e.key === 'Escape') {
                    commentTextElement.textContent = commentIcon.dataset.comment;
                }
            });
            
            // Save on focus lost
            input.addEventListener('blur', (e) => {
                // Small timeout to allow button click to register
                setTimeout(() => {
                    if (document.activeElement !== saveButton) {
                        saveEdit();
                    }
                }, 100);
            });
        });
        
        // Add actions container
        const actionsContainer = document.createElement('div');
        actionsContainer.className = 'comment-actions';
        
        // Add resolve button
        const resolveButton = document.createElement('button');
        resolveButton.className = 'resolve-btn';
        resolveButton.textContent = '✓';
        resolveButton.addEventListener('click', (e) => {
            e.stopPropagation();
            
            // Find comment in array and mark as resolved
            const commentIndex = comments.findIndex(c => c.id === commentId);
            if (commentIndex !== -1) {
                comments[commentIndex].resolved = true;
                saveComments();
                
                // Remove from DOM
                document.body.removeChild(commentIcon);
            }
        });
        actionsContainer.appendChild(resolveButton);
        
        tooltip.appendChild(actionsContainer);
        
        // Add tooltip to icon
        commentIcon.appendChild(tooltip);
        
        // Add icon to body
        document.body.appendChild(commentIcon);
        
        // Make only the icon draggable (not the tooltip/text)
        makeElementDraggable(commentIcon, commentId);
    }
    
    // Function to make an element draggable
    function makeElementDraggable(element, commentId) {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        let initialX = 0, initialY = 0;
        
        element.onmousedown = function(e) {
            // Prevent dragging if we're in edit mode
            if (element.querySelector('.edit-container')) {
                return;
            }
            
            // Prevent text selection while dragging
            e.preventDefault();
            
            // Store initial positions
            initialX = parseInt(element.style.left);
            initialY = parseInt(element.style.top);
            
            // Get the mouse cursor position at startup
            pos3 = e.clientX;
            pos4 = e.clientY;
            document.onmouseup = closeDragElement;
            // Call a function whenever the cursor moves
            document.onmousemove = elementDrag;
        };
        
        function elementDrag(e) {
            e.preventDefault();
            
            // Calculate the new cursor position
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;
            
            // Set the element's new position
            element.style.top = (element.offsetTop - pos2) + "px";
            element.style.left = (element.offsetLeft - pos1) + "px";
        }
        
        function closeDragElement() {
            // Stop moving when mouse button is released
            document.onmouseup = null;
            document.onmousemove = null;
            
            // Update position in comments array and save
            if (commentId) {
                const commentIndex = comments.findIndex(c => c.id === commentId);
                if (commentIndex !== -1) {
                    const newX = parseInt(element.style.left);
                    const newY = parseInt(element.style.top);
                    
                    // Calculate the movement delta
                    const deltaX = newX - initialX;
                    const deltaY = newY - initialY;
                    
                    // Update comment position
                    comments[commentIndex].x = newX;
                    comments[commentIndex].y = newY;
                    
                    // If there's selection data, update its position
                    if (comments[commentIndex].selection) {
                        comments[commentIndex].selection.x += deltaX;
                        comments[commentIndex].selection.y += deltaY;
                    }
                    
                    saveComments();
                }
            }
        }
    }

    // We gaan een aantal HTML dingen injecteren in de pagina
    const toolboxContainer = document.createElement('div');
    toolboxContainer.innerHTML = `
    <div class="toolboxContainer">
        <ul>
            <li>
                <button id="commentButton">
                    <span><div class="comment-icon-icon"></div></span>
                    <span>Comment</span>
                </button>
            </li>
        </ul>
    </div>
`;

    document.body.appendChild(toolboxContainer);

    // Handle button clicks
    const commentButton = document.getElementById('commentButton');
    commentButton.addEventListener('click', () => {
        toggleState('comment');
    });

   

    // Function to toggle state and update UI
    function toggleState(newState) {
        // If clicking the same button again, turn it off
        if (currentState === newState) {
            currentState = null;
            commentButton.classList.remove('active');
            document.body.classList.remove('comment-mode');
            updateCursorIcon();
            return;
        }

        // Set new state and update UI
        currentState = newState;
        
        // Update button states
        commentButton.classList.toggle('active', currentState === 'comment');
        
        // Toggle comment mode class on body
        document.body.classList.toggle('comment-mode', currentState === 'comment');
        
        // Update cursor icon
        updateCursorIcon();
    }

    // Update cursor icon based on current state
    function updateCursorIcon() {
        // Remove any existing cursor icon
        const existingCursor = document.getElementById('cursorIcon');
        if (existingCursor) {
            document.body.removeChild(existingCursor);
        }

        // If no active state, remove event listener
        if (!currentState) {
            document.removeEventListener('mousemove', moveCursorIcon);
            return;
        }

        // Create cursor icon
        const cursor = document.createElement('div');
        cursor.id = 'cursorIcon';
        cursor.style.position = 'fixed';
        cursor.style.pointerEvents = 'none'; // Make sure it doesn't interfere with clicks
        cursor.style.zIndex = '9999';
        
        
        document.body.appendChild(cursor);
        
        // Add mousemove event listener to move the cursor icon
        document.addEventListener('mousemove', moveCursorIcon);
        
        // Initial position
        moveCursorIcon({ clientX: 0, clientY: 0 });
    }
    
    function moveCursorIcon(e) {
        const cursor = document.getElementById('cursorIcon');
        if (cursor) {
            // Position with a small offset
            cursor.style.left = (e.clientX + 15) + 'px';
            cursor.style.top = (e.clientY + 15) + 'px';
        }
    }
    
    // Handle resize events to reposition comments
    window.addEventListener('resize', repositionComments);
    
    function repositionComments() {
        // Get all comment icons
        const commentIcons = document.querySelectorAll('.comment-icon');
        const selectionHighlights = document.querySelectorAll('.selection-highlight');
        
        // Reposition each comment icon
        commentIcons.forEach(icon => {
            const commentId = icon.dataset.id;
            const comment = comments.find(c => c.id === commentId);
            
            if (comment) {
                // Get the relative position
                const relPos = toRelativePosition(comment.x, comment.y);
                // Convert back to absolute for the current screen size
                const absPos = toAbsolutePosition(relPos.xPercent, relPos.yPercent);
                
                // Update position
                icon.style.left = absPos.x + 'px';
                icon.style.top = absPos.y + 'px';
            }
        });
        
        // Reposition each selection highlight
        selectionHighlights.forEach(highlight => {
            const commentId = highlight.dataset.commentId;
            const comment = comments.find(c => c.id === commentId);
            
            if (comment && comment.selection) {
                // Get the relative position and dimensions
                const relPos = toRelativePosition(comment.selection.x, comment.selection.y);
                const relDim = toRelativeDimensions(comment.selection.width, comment.selection.height);
                
                // Convert back to absolute for the current screen size
                const absPos = toAbsolutePosition(relPos.xPercent, relPos.yPercent);
                const absDim = toAbsoluteDimensions(relDim.widthPercent, relDim.heightPercent);
                
                // Update position and dimensions
                highlight.style.left = absPos.x + 'px';
                highlight.style.top = absPos.y + 'px';
                highlight.style.width = absDim.width + 'px';
                highlight.style.height = absDim.height + 'px';
            }
        });
    }

    // Load styles and comments when script initializes
    storeReferenceScreenSize(); // Store initial screen size
    loadComments();
}())