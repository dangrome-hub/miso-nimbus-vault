// js/calendar.js

// Ensure supabase is mapped properly
window.supabase = window.supabaseClientInstance || window.supabase;
let calendar;
let globalIsAdmin = false;

document.addEventListener('DOMContentLoaded', () => {
    initCalendar();
    
    // Listen for the login toggle from app.js
    document.addEventListener('authChange', (e) => {
        globalIsAdmin = e.detail.isAdmin;
        if (calendar) {
            calendar.setOption('selectable', globalIsAdmin);
            calendar.setOption('editable', globalIsAdmin);
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

    const today = new Date();
    const validRangeStart = `${today.getFullYear() - 2}-01-01`;
    const validRangeEnd = `${today.getFullYear() + 15}-01-01`;

    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'multiMonth',
        initialDate: today,
        views: {
            multiMonth: {
                duration: { months: 18 },
                dateIncrement: { months: 1 }
            }
        },
        multiMonthMaxColumns: 1,
        customButtons: {
            goToday: {
                text: 'Today',
                click: () => {
                    if (calendar) calendar.today();
                }
            }
        },
        headerToolbar: {
            left: 'goToday prev,next',
            center: 'title',
            right: ''
        },
        validRange: {
            start: validRangeStart,
            end: validRangeEnd
        },
        multiMonthTitleFormat: { month: 'long', year: 'numeric' },
        
        selectable: globalIsAdmin,
        editable: globalIsAdmin,
        
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
                    
                    // FullCalendar exclusive end date logic
                    let endObj = new Date(trip.end_date + 'T00:00:00');
                    endObj.setDate(endObj.getDate() + 1);
                    const endISO = `${endObj.toISOString().split('T')[0]}T${eTimeRaw}:00`;
                    
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
                            rawTripData: trip // Clean database object payload
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

            if (window.openTripModal) {
                // Pass a clean fake DB object to app.js
                window.openTripModal({
                    id: null,
                    title: 'Away Block 🌴',
                    start_date: cleanStartDate,
                    end_date: cleanEndDate,
                    start_time: '09:00',
                    end_time: '18:00',
                    include_neighbors: false,
                    status: 'uncovered'
                });
            }
            calendar.unselect();
        },

        dateClick: function(info) {
            if (!globalIsAdmin) return;

            const cleanStartDate = info.dateStr;
            if (window.openTripModal) {
                window.openTripModal({
                    id: null,
                    title: 'Away Block 🌴',
                    start_date: cleanStartDate,
                    end_date: cleanStartDate,
                    start_time: '09:00',
                    end_time: '18:00',
                    include_neighbors: false,
                    status: 'uncovered'
                });
            }
        },

        eventClick: function(clickInfo) {
            if (window.openTripModal) {
                // Pass the clean database object stored inside the event
                window.openTripModal(clickInfo.event.extendedProps.rawTripData);
            }
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