module.exports = function(hatch, opts, err) {
    hatch.emit('error', {
        message: err.toString()
    });
};