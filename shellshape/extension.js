// shellshape -- a tiling window manager extension for gnome-shell

const Lang = imports.lang;
const Main = imports.ui.main;
const Shell = imports.gi.Shell;
const St = imports.gi.St;
const Mainloop = imports.mainloop;
const Signals = imports.signals;

const Extension = imports.ui.extensionSystem.extensions['shellshape@gfxmonk.net'];
const Tiling = Extension.tiling;
const Window = Extension.mutter_window.Window;
const Workspace = Extension.workspace.Workspace;
const ShellshapeIndicator = Extension.indicator.ShellshapeIndicator;
const Gdk = imports.gi.Gdk;


const Ext = function Ext() {
	let self = this;
	self.workspaces = {};
	self.windows = {};
	//TODO: non-primaty monitor!
	self.monitor = global.get_primary_monitor();
	self.screen = global.screen;

	self.screen_dimensions = {}
	self.screen_dimensions.width = self.monitor.width;
	self.screen_dimensions.offset_x = 0;
	self.screen_dimensions.offset_y = Main.panel.actor.height;
	self.screen_dimensions.height = self.monitor.height - self.screen_dimensions.offset_y;

	self._do = function _do(action) {
		try {
			action();
		} catch (e) {
			log("ERROR in tiling: " + e);
			log("err = " + JSON.stringify(e));
		}
	};

	function handle(name, func) {
		Main.wm.setKeybindingHandler('key_win_' + name, function() {
			log("handling trigger " + name);
			self._do(func);
		});
	}

	self.get_workspace = function get_workspace(meta_workspace) {
		let workspace = self.workspaces[meta_workspace];
		if(typeof(workspace) == "undefined") {
			var layout = new Tiling.HorizontalTiledLayout(
					self.screen_dimensions.offset_x,
					self.screen_dimensions.offset_y,
					self.screen_dimensions.width,
					self.screen_dimensions.height);
			workspace = self.workspaces[meta_workspace] = new Workspace(meta_workspace, layout, self);;
		}
		return workspace;
	};

	self.get_window = function get_window(meta_window) {
		if(!meta_window) {
			log("bad window: " + meta_window);
			return null;
		}
		var win = self.windows[meta_window];
		if(typeof(win) == "undefined") {
			win = self.windows[meta_window] = new Window(meta_window, self);
		}
		return win;
	};

	self.current_workspace = function current_workspace() {
		return self.get_workspace(self.current_meta_workspace());
	};

	self.current_meta_workspace = function current_meta_workspace() {
		return global.screen.get_workspace_by_index(global.screen.get_active_workspace_index());
	};

	self.current_layout = function current_layout() {
		return self.get_workspace(self.current_meta_workspace()).layout;
	};

	self.current_display = function current_display() {
		return global.screen.get_display();
	};

	self.current_window = function current_window() {
		return self.get_window(self.current_display()['focus-window']);
	};

	self.switch_workspace = function switch_workspace(offset, window) {
		let activate_index = global.screen.get_active_workspace_index()
		let new_index = activate_index + offset;
		if(new_index < 0 || new_index > global.screen.get_n_workspaces()) {
			log("No such workspace; ignoring");
			return;
		}

		let next_workspace = global.screen.get_workspace_by_index(new_index);
		if(window !== undefined) {
			window.move_to_workspace(new_index);
			next_workspace.activate_with_focus(window.meta_window, global.get_current_time())
		} else {
			next_workspace.activate(true);
		}
	};

	self._init_keybindings = function _init_keybindings() {
		log("adding keyboard handlers for Shellshape");
		var BORDER_RESIZE_INCREMENT = 0.05;
		var WINDOW_ONLY_RESIZE_INGREMENT = BORDER_RESIZE_INCREMENT * 2;
		handle('p',           function() { self.current_layout().tile(self.current_window())});
		handle('y',           function() { self.current_layout().untile(self.current_window()); });
		handle('shift_p',     function() { self.current_layout().adjust_splits_to_fit(self.current_window()); });
		handle('comma',       function() { self.current_layout().add_main_window_count(1); });
		handle('dot',         function() { self.current_layout().add_main_window_count(-1); });

		handle('j',           function() { self.current_layout().select_cycle(1); });
		handle('k',           function() { self.current_layout().select_cycle(-1); });
		handle('tab',         function() { self.current_layout().select_cycle(1); });
		handle('shift_tab',   function() { self.current_layout().select_cycle(-1); });

		handle('shift_j',     function() { self.current_layout().cycle(1); });
		handle('shift_k',     function() { self.current_layout().cycle(-1); });

		handle('space',       function() { self.current_layout().main_window().activate(); });
		handle('shift_space', function() { self.current_layout().swap_active_with_main(); });

		// layout changers
		handle('d',           function() { self.change_layout(true); });
		handle('f',           function() { self.change_layout(false); });

		// move a window's borders to resize it
		handle('h',           function() { self.current_layout().adjust_main_window_area(-BORDER_RESIZE_INCREMENT); });
		handle('l',           function() { self.current_layout().adjust_main_window_area(+BORDER_RESIZE_INCREMENT); });
		handle('u',           function() { self.current_layout().adjust_current_window_size(-BORDER_RESIZE_INCREMENT); });
		handle('i',           function() { self.current_layout().adjust_current_window_size(+BORDER_RESIZE_INCREMENT); });

		// resize a window without affecting others
		handle('shift_h',     function() { self.current_layout().scale_current_window(-WINDOW_ONLY_RESIZE_INGREMENT, 'x'); });
		handle('shift_l',     function() { self.current_layout().scale_current_window(+WINDOW_ONLY_RESIZE_INGREMENT, 'x'); });
		handle('shift_u',     function() { self.current_layout().scale_current_window(-WINDOW_ONLY_RESIZE_INGREMENT, 'y'); });
		handle('shift_i',     function() { self.current_layout().scale_current_window(+WINDOW_ONLY_RESIZE_INGREMENT, 'y'); });
		handle('minus',       function() { self.current_layout().scale_current_window(-WINDOW_ONLY_RESIZE_INGREMENT); });
		handle('plus',        function() { self.current_layout().scale_current_window(+WINDOW_ONLY_RESIZE_INGREMENT); });

		handle('alt_j',       function() { self.switch_workspace(+1); });
		handle('alt_k',       function() { self.switch_workspace(-1); });
		handle('alt_shift_j', function() { self.switch_workspace(+1, self.current_window()); });
		handle('alt_shift_k', function() { self.switch_workspace(-1, self.current_window()); });
		handle('z',           function() { self.current_layout().toggle_maximize();});
		handle('shift_m',     function() { self.current_layout().unminimize_last_window();});
		log("Done adding keyboard handlers for Shellshape");
	};

	self.change_layout = function(do_tile) {
		self.current_workspace().tile_all(do_tile);
		self.emit('layout-changed');
	};
	
	self.remove_workspace = function(meta_workspace) {
		delete self.workspaces[meta_workspace];
		//TODO: clean up windows in workspace? probably shouldn't happen given how GS works
	};

	self.remove_window = function(meta_window) {
		delete self.windows[meta_window];
	};

	self._init_workspaces = function() {
		self.screen = global.screen;
		self.screen.connect('workspace-added', function(screen, workspace) { self.get_workspace(workspace); });
		self.screen.connect('workspace-removed', self.remove_workspace);

		// add existing workspaces
		// (yay, iteration!)
		for (let i = 0; i < self.screen.n_workspaces; i++) {
			self.get_workspace(self.screen.get_workspace_by_index(i));
		}
	};

	self._init_indicator = function() {
		ShellshapeIndicator.init(self);
	};
	self.toString = function() {
		return "<Shellshape Extension>";
	};

	self._do(self._init_keybindings);
	self._do(self._init_workspaces);
	self._do(self._init_indicator);
};

Signals.addSignalMethods(Ext.prototype);

// initialization
function main() {
	log("shellshape initialized!");

	// inject the get_mouse_position function
	Tiling.get_mouse_position = function() {
		let display = Gdk.Display.get_default();
		let device_manager = display.get_device_manager();
		let pointer = device_manager.get_client_pointer();
		let [screen, pointerX, pointerY] = pointer.get_position();
		return {x: pointerX, y: pointerY};
	};

	//TODO: move into separate extension
	St.set_slow_down_factor(0.75);

	let ext = new Ext();
}