import QUnit from 'steal-qunit';
import canReact from 'can-react';

QUnit.module('can-react', () => {

	QUnit.module('createClass', () => {

		QUnit.test('exists', (assert) => {

			assert.equal(typeof canReact.createClass, 'function', 'is a function');

		});

	});

});
