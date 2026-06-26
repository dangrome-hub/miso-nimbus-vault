// js/calendar.js

// Ensure supabase is mapped properly even if config loaded slightly out of order
window.supabase = window.supabaseClientInstance || window.supabase;
let calendar;

document.addEventListener('DOMContentLoaded', () => {
    initCalendar();
    document.addEventListener('authChange', (e) => {
        if (calendar) {
            calendar.setOption('selectable', e.detail.isAdmin);
            calendar.setOption('editable', e.detail.isAdmin);
            calendar.refetchEvents();
        }
    });
});

function formatTimeLabel(timeStr) {
    if(!timeStr) return '';
    if (timeStr === 'morning') return '9am';
    if (timeStr === 'evening') return '6pm';
    const [h, m] = timeStr.split(':');
    let hour = parseInt(h, 10);
    const suffix = hour >= 12 ? 'pm' : 'am';
    hour = hour % 12 || 12;
    return `${hour}${suffix}`;
}

function formatShortDate(dateStr) {
    if(!dateStr) return '';
    const parts = dateStr.split('-');
    return `${parts[1]}/${parts[2]}`;
}

let globalTripsData = [];

async function initCalendar() {
    const calendarEl = document.getElementById('calendar');
    if (!calendarEl) return;

    // Use a safe fallback for checking the session in case window object isn't fully ready
    const activeSupabase = window.supabaseClientInstance || window.supabase;
    let isAdmin = false;
    
    if (activeSupabase && activeSupabase.auth) {
        const sessionCheck = await activeSupabase.auth.getSession();
        isAdmin = !!sessionCheck.data.session;
    }

    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'multiMonthYear',
        multiMonthMaxColumns: 1, 
        
        headerToolbar: {
            left: 'today prev,next',
            center: 'title',
            right: ''
        },
        buttonText: {
            today: 'Today' // Explicitly sets the button string capitalization
        },
        validRange: {
            start: '2026-01-01',
            end: '2041-01-01'
        },
        multiMonthTitleFormat: { month: 'long', year: 'numeric' },
        
        selectable: isAdmin,     
        editable: isAdmin,       
        
        events: async function(fetchInfo, successCallback, failureCallback) {
            try {
                const currentSupabase = window.supabaseClientInstance || window.supabase;
                if (!currentSupabase) {
                    successCallback([]);
                    return;
                }
                
                const { data, error } = await currentSupabase.from('trips').select('*');
                if (error) throw error;

                globalTripsData = data;
                
                const calendarEvents = data.map(trip => {
                    const isClaimed = trip.status === 'claimed';
                    const isPartial = trip.status === 'partial';
                    let label = trip.title ? trip.title.trim() : 'Away';
                    
                    if (trip.include_neighbors && trip.neighbor_start_date && trip.neighbor_end_date) {
                        label += ` (+34a: ${formatShortDate(trip.neighbor_start_date)}-${formatShortDate(trip.neighbor_end_date)})`;
                    } else if (trip.include_neighbors) {
                        label += ' (+34a)';
                    }
                    
                    let sTimeRaw = trip.start_time || '09:00';
                    let eTimeRaw = trip.end_time || '18:00';
                    if (sTimeRaw === 'morning') sTimeRaw = '09:00';
                    if (sTimeRaw === 'evening') sTimeRaw = '18:00';
                    if (eTimeRaw === 'morning') eTimeRaw = '09:00';
                    if (eTimeRaw === 'evening') eTimeRaw = '18:00';
                    
                    const startISO = `${trip.start_date}T${sTimeRaw}:00`;
                    const endISO = `${trip.end_date}T${eTimeRaw}:00`;
                    
                    const sTimeFormatted = formatTimeLabel(trip.start_time);
                    const eTimeFormatted = formatTimeLabel(trip.end_time);
                    
                    let bg = '#e59c22'; 
                    let titleStr = `(${sTimeFormatted}) ${label} (${eTimeFormatted})`;
                    
                    if (isClaimed) {
                        bg = '#2ea169';
                        titleStr = ` Covered: ${trip.claimed_by || 'Friend'}`;
                    } else if (isPartial) {
                        bg = '#1073e5';
                        titleStr = ` Part Covered`;
                    }
                    
                    return {
                        id: trip.id,
                        title: titleStr,
                        start: startISO,
                        end: endISO, 
                        allDay: false, 
                        backgroundColor: bg,
                        borderColor: bg,
                        extendedProps: {
                            tripTitle: trip.title,
                            status: trip.status,
                            claimedBy: trip.claimed_by,
                            notes: trip.notes,
                            rawStartDate: trip.start_date,
                            rawEndDate: trip.end_date,
                            startTime: sTimeRaw,
                            endTime: eTimeRaw,
                            includeNeighbors: trip.include_neighbors,
                            neighborStartDate: trip.neighbor_start_date,
                            neighborEndDate: trip.neighbor_end_date
                        }
                    };
                });
                
                successCallback(calendarEvents);
            } catch (err) {
                console.error(err);
                failureCallback(err);
            }
        },

        dayCellDidMount: function(arg) {
            const cellDateStr = arg.date.toISOString().split('T')[0];
            const matchingTrip = globalTripsData.find(trip => cellDateStr >= trip.start_date && cellDateStr <= trip.end_date);

            if (matchingTrip) {
                let imgFile = matchingTrip.include_neighbors ? "Cecil & Chutney.png" : "Miso & Nimbus.jpg";
                arg.el.style.backgroundImage = `url('${imgFile}')`;
                arg.el.style.backgroundSize = 'cover';
                arg.el.style.backgroundPosition = 'center';
                arg.el.style.position = 'relative';
                
                const oldOverlay = arg.el.querySelector('.custom-cell-scrim');
                if (oldOverlay) oldOverlay.remove();

                let dynamicOverlay = document.createElement('div');
                dynamicOverlay.className = 'custom-cell-scrim';
                dynamicOverlay.style.position = 'absolute';
                dynamicOverlay.style.top = '0'; dynamicOverlay.style.left = '0';
                dynamicOverlay.style.right = '0'; dynamicOverlay.style.bottom = '0';
                dynamicOverlay.style.background = 'rgba(255, 255, 255, 0.55)'; 
                dynamicOverlay.style.zIndex = '1'; dynamicOverlay.style.pointerEvents = 'none';
                
                if (arg.el.querySelector('.fc-daygrid-day-frame')) {
                    arg.el.querySelector('.fc-daygrid-day-frame').style.position = 'relative';
                    arg.el.querySelector('.fc-daygrid-day-frame').style.zIndex = '2';
                }
                arg.el.appendChild(dynamicOverlay);
            } else {
                arg.el.style.backgroundImage = 'none';
                const oldOverlay = arg.el.querySelector('.custom-cell-scrim');
                if (oldOverlay) oldOverlay.remove();
            }
        },

        eventsSet: function() {
            const cells = calendarEl.querySelectorAll('.fc-daygrid-day');
            cells.forEach(cellEl => {
                const cellDateStr = cellEl.getAttribute('data-date');
                if (!cellDateStr) return;

                const matchingTrip = globalTripsData.find(trip => cellDateStr >= trip.start_date && cellDateStr <= trip.end_date);
                if (matchingTrip) {
                    let imgFile = matchingTrip.include_neighbors ? "Cecil & Chutney.png" : "Miso & Nimbus.jpg";
                    cellEl.style.backgroundImage = `url('${imgFile}')`;
                    cellEl.style.backgroundSize = 'cover';
                    cellEl.style.backgroundPosition = 'center';
                    if (cellEl.querySelector('.fc-daygrid-day-frame')) {
                        cellEl.querySelector('.fc-daygrid-day-frame').style.position = 'relative';
                        cellEl.querySelector('.fc-daygrid-day-frame').style.zIndex = '2';
                    }
                } else {
                    cellEl.style.backgroundImage = 'none';
                    const oldOverlay = cellEl.querySelector('.custom-cell-scrim');
                    if (oldOverlay) oldOverlay.remove();
                }
            });
        },

        select: function(selectionInfo) {
            const cleanStartDate = selectionInfo.startStr;
            let cleanEndDate = selectionInfo.endStr;
            if (cleanStartDate !== selectionInfo.endStr) cleanEndDate = subtractOneDay(selectionInfo.endStr);
            if (new Date(cleanEndDate) < new Date(cleanStartDate)) cleanEndDate = cleanStartDate;

            document.dispatchEvent(new CustomEvent('openTripModal', {
                detail: {
                    id: null, start: cleanStartDate, end: cleanEndDate,
                    extendedProps: { tripTitle: '', status: 'unclaimed', claimedBy: null, notes: '', startTime: '09:00', endTime: '18:00', includeNeighbors: false, neighborStartDate: null, neighborEndDate: null }
                }
            }));
            calendar.unselect();
        },

        eventClick: function(clickInfo) {
            document.dispatchEvent(new CustomEvent('openTripModal', { 
                detail: { 
                    id: clickInfo.event.id,
                    start: clickInfo.event.extendedProps.rawStartDate,
                    end: clickInfo.event.extendedProps.rawEndDate,
                    extendedProps: clickInfo.event.extendedProps
                } 
            }));
        }
    });
    calendar.render();
}

function subtractOneDay(dateStr) {
    let d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
}

window.refreshCalendarData = () => { 
    if (calendar) calendar.refetchEvents(); 
    if (window.refreshSidebarView) window.refreshSidebarView();
};