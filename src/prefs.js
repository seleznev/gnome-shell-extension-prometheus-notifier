/*
 * Copyright (C) 2018 Aleksandr Seleznev <alex@slznv.net>
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

const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;

const Gettext = imports.gettext.domain('gnome-shell-extensions-prometheus-notifier');
const _ = Gettext.gettext;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;

function init() {
    Convenience.initTranslations();
}

const PrometheusNotifierPrefsWidget = new GObject.Class({
    Name: 'PrometheusNotifier.Prefs.Widget',
    GTypeName: 'PrometheusNotifierPrefsWidget',
    Extends: Gtk.Grid,

    _init: function(params) {
        this.parent(params);
        this.margin = 12;
        this.row_spacing = this.column_spacing = 6;
        this.set_orientation(Gtk.Orientation.VERTICAL);

        // Alertmanager URL
        this.add(new Gtk.Label({ label: '<b>' + _("Alertmanager URL") + '</b>',
                                 use_markup: true,
                                 halign: Gtk.Align.START }));

        let url_entry = new Gtk.Entry({ hexpand: true,
                                        margin_bottom: 12 });
        this.add(url_entry);

        this._settings = Convenience.getSettings();
        this._settings.bind('url', url_entry, 'text', Gio.SettingsBindFlags.DEFAULT);

        // Receiver filter
        this.add(new Gtk.Label({ label: '<b>' + _("Receiver filter (regex)") + '</b>',
                                 use_markup: true,
                                 halign: Gtk.Align.START }));

        let receiver_entry = new Gtk.Entry({ hexpand: true,
                                             margin_bottom: 12 });
        this.add(receiver_entry);

        this._settings = Convenience.getSettings();
        this._settings.bind('receiver-filter', receiver_entry, 'text',
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

        this._settings = Convenience.getSettings();
        this._settings.bind('update-interval', update_interval_entry, 'value', Gio.SettingsBindFlags.DEFAULT);
    }
});

function buildPrefsWidget() {
    let widget = new PrometheusNotifierPrefsWidget();
    widget.show_all();

    return widget;
}
