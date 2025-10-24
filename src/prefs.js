/*
 * Copyright (C) 2018-2025 Aleksandr Seleznev <alex@slznv.net>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, see <http://www.gnu.org/licenses/>.
 */

import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

class PrometheusNotifierPrefsWidget extends Adw.PreferencesGroup {
    static {
        GObject.registerClass(this);
    }

    constructor(settings) {
        super(settings);

        // Alertmanager URL
        this.add(new Gtk.Label({ label: '<b>' + _("Alertmanager URL") + '</b>',
                                 use_markup: true,
                                 halign: Gtk.Align.START }));

        let url_entry = new Gtk.Entry({ hexpand: true,
                                        margin_bottom: 12 });
        this.add(url_entry);

        settings.bind('url', url_entry, 'text', Gio.SettingsBindFlags.DEFAULT);

        // Label filter
        this.add(new Gtk.Label({ label: '<b>' + _("Label filter (labels matchers)") + '</b>',
                                 use_markup: true,
                                 halign: Gtk.Align.START }));

        let filter_entry = new Gtk.Entry({ hexpand: true,
                                           margin_bottom: 12 });
        this.add(filter_entry);

        settings.bind('label-filter', filter_entry, 'text',
                            Gio.SettingsBindFlags.DEFAULT);

        // Receiver filter
        this.add(new Gtk.Label({ label: '<b>' + _("Receiver filter (regex)") + '</b>',
                                 use_markup: true,
                                 halign: Gtk.Align.START }));

        let receiver_entry = new Gtk.Entry({ hexpand: true,
                                             margin_bottom: 12 });
        this.add(receiver_entry);

        settings.bind('receiver-filter', receiver_entry, 'text',
                            Gio.SettingsBindFlags.DEFAULT);

        // Update interval
        this.add(new Gtk.Label({ label: '<b>' + _("Update interval (sec)") + '</b>',
                                 use_markup: true,
                                 halign: Gtk.Align.START }));

        let update_interval_adjustment = new Gtk.Adjustment({ lower: 1,
                                                              upper: 604800, // 7d
                                                              step_increment: 1,
                                                              page_increment: 10 });
        let update_interval_entry = new Gtk.SpinButton({ adjustment: update_interval_adjustment,
                                                         numeric: true,
                                                         hexpand: true,
                                                         margin_bottom: 12 });
        this.add(update_interval_entry);

        settings.bind('update-interval', update_interval_entry, 'value', Gio.SettingsBindFlags.DEFAULT);
    }
}

export default class PrometheusNotifierExtensionPreferences extends ExtensionPreferences {
    getPreferencesWidget() {
        return new PrometheusNotifierPrefsWidget(this.getSettings());
    }
}
