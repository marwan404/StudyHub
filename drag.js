const grid = document.querySelector('.site-grid');
new Sortable(grid, {
    animation: 150,
    ghostClass: 'dragging', // will add your CSS effect
    onEnd: (evt) => {
        console.log('Moved card from', evt.oldIndex, 'to', evt.newIndex);
    }
});
